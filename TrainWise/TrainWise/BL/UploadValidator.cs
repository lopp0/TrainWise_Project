using Microsoft.AspNetCore.Http;

namespace TrainWise.BL
{
    /// <summary>
    /// Validates user-uploaded images before they are written under wwwroot (which
    /// is served publicly by app.UseStaticFiles()). Without this, a caller could
    /// upload an .html/.svg/.js file and get stored XSS on the API's own origin, or
    /// upload an arbitrarily large file to exhaust disk.
    ///
    /// The returned extension is derived from the SNIFFED magic bytes, never from
    /// the client-supplied file name, so the on-disk extension can't be spoofed.
    /// </summary>
    public static class UploadValidator
    {
        public const long MaxBytes = 6 * 1024 * 1024;       // 6 MB — images
        public const long MaxAudioBytes = 12 * 1024 * 1024;  // 12 MB — voice messages (#139)
        public const long MaxVideoBytes = 100 * 1024 * 1024; // 100 MB — form-check clips (#135)

        /// <summary>
        /// Returns true if the file is an allowed image. On success, <paramref name="safeExtension"/>
        /// is set from the detected type (e.g. ".jpg"). On failure, <paramref name="error"/> explains why.
        /// </summary>
        public static bool TryValidateImage(IFormFile? file, out string safeExtension, out string error)
        {
            safeExtension = ".jpg";
            error = "";

            if (file == null || file.Length == 0)
            {
                error = "No file uploaded.";
                return false;
            }
            if (file.Length > MaxBytes)
            {
                error = $"File too large (max {MaxBytes / (1024 * 1024)} MB).";
                return false;
            }

            // Read the first bytes to sniff the real content type (don't trust the
            // client's Content-Type header or file name).
            byte[] header = new byte[12];
            int read;
            using (var s = file.OpenReadStream())
            {
                read = s.Read(header, 0, header.Length);
            }
            if (read < 4)
            {
                error = "File is too short to be a valid image.";
                return false;
            }

            string? kind = SniffImage(header, read);
            if (kind == null)
            {
                error = "Unsupported file type. Only JPEG, PNG, GIF and WebP images are allowed.";
                return false;
            }

            safeExtension = kind;
            return true;
        }

        /// <summary>
        /// #139 — validates a voice-message upload (m4a/aac, mp3, wav, ogg) by
        /// sniffing magic bytes. The on-disk extension is derived from the bytes,
        /// never the client file name (same anti-XSS rule as images).
        /// </summary>
        public static bool TryValidateAudio(IFormFile? file, out string safeExtension, out string error)
            => TryValidateMedia(file, MaxAudioBytes, SniffAudio, ".m4a",
                "Unsupported audio type. Only M4A/AAC, MP3, WAV and OGG are allowed.",
                out safeExtension, out error);

        /// <summary>
        /// #135 — validates a form-check video upload (mp4/mov, webm) by sniffing
        /// magic bytes. Larger size cap than images; type derived from the bytes.
        /// </summary>
        public static bool TryValidateVideo(IFormFile? file, out string safeExtension, out string error)
            => TryValidateMedia(file, MaxVideoBytes, SniffVideo, ".mp4",
                "Unsupported video type. Only MP4/MOV and WebM are allowed.",
                out safeExtension, out error);

        // Shared size/short-file guard + magic-byte sniff for audio/video.
        private static bool TryValidateMedia(IFormFile? file, long maxBytes,
            Func<byte[], int, string?> sniff, string fallbackExt, string unsupportedMsg,
            out string safeExtension, out string error)
        {
            safeExtension = fallbackExt;
            error = "";

            if (file == null || file.Length == 0)
            {
                error = "No file uploaded.";
                return false;
            }
            if (file.Length > maxBytes)
            {
                error = $"File too large (max {maxBytes / (1024 * 1024)} MB).";
                return false;
            }

            byte[] header = new byte[16];
            int read;
            using (var s = file.OpenReadStream())
            {
                read = s.Read(header, 0, header.Length);
            }
            if (read < 8)
            {
                error = "File is too short to be valid.";
                return false;
            }

            string? kind = sniff(header, read);
            if (kind == null)
            {
                error = unsupportedMsg;
                return false;
            }

            safeExtension = kind;
            return true;
        }

        // Returns the canonical extension for a recognized image, else null.
        private static string? SniffImage(byte[] b, int len)
        {
            // JPEG: FF D8 FF
            if (len >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF)
                return ".jpg";

            // PNG: 89 50 4E 47 0D 0A 1A 0A
            if (len >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47
                && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A)
                return ".png";

            // GIF: "GIF87a" / "GIF89a"
            if (len >= 6 && b[0] == 0x47 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x38
                && (b[4] == 0x37 || b[4] == 0x39) && b[5] == 0x61)
                return ".gif";

            // WebP: "RIFF" .... "WEBP"
            if (len >= 12 && b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46
                && b[8] == 0x57 && b[9] == 0x45 && b[10] == 0x42 && b[11] == 0x50)
                return ".webp";

            return null;
        }

        // "ftyp" box at offset 4 (ISO base media — mp4/m4a/mov share it).
        private static bool HasFtyp(byte[] b, int len) =>
            len >= 8 && b[4] == 0x66 && b[5] == 0x74 && b[6] == 0x79 && b[7] == 0x70; // "ftyp"

        // The 4-char major brand at offset 8 (e.g. "M4A ", "isom", "mp42", "qt  ").
        private static string Brand(byte[] b, int len) =>
            len >= 12 ? System.Text.Encoding.ASCII.GetString(b, 8, 4) : "";

        // Audio: M4A/AAC (ftyp + M4A/mp4 brand), MP3 (ID3 / frame sync), WAV, OGG.
        private static string? SniffAudio(byte[] b, int len)
        {
            if (HasFtyp(b, len))
            {
                string brand = Brand(b, len);
                if (brand.StartsWith("M4A") || brand.StartsWith("M4B") || brand.StartsWith("mp4"))
                    return ".m4a";
                // A bare AAC-in-mp4 recording without an M4A brand still plays as .m4a.
                return ".m4a";
            }
            // MP3: "ID3" tag, or an MPEG audio frame sync (FF Ex/Fx).
            if (len >= 3 && b[0] == 0x49 && b[1] == 0x44 && b[2] == 0x33) return ".mp3";
            if (len >= 2 && b[0] == 0xFF && (b[1] & 0xE0) == 0xE0) return ".mp3";
            // WAV: "RIFF" .... "WAVE"
            if (len >= 12 && b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46
                && b[8] == 0x57 && b[9] == 0x41 && b[10] == 0x56 && b[11] == 0x45)
                return ".wav";
            // OGG: "OggS"
            if (len >= 4 && b[0] == 0x4F && b[1] == 0x67 && b[2] == 0x67 && b[3] == 0x53) return ".ogg";
            return null;
        }

        // Video: MP4/MOV (ftyp, non-audio brand) and WebM/Matroska (EBML header).
        private static string? SniffVideo(byte[] b, int len)
        {
            if (HasFtyp(b, len))
            {
                string brand = Brand(b, len);
                // Don't accept an audio-only container as a "video".
                if (brand.StartsWith("M4A") || brand.StartsWith("M4B")) return null;
                if (brand.StartsWith("qt")) return ".mov";
                return ".mp4";
            }
            // WebM / Matroska: EBML magic 1A 45 DF A3
            if (len >= 4 && b[0] == 0x1A && b[1] == 0x45 && b[2] == 0xDF && b[3] == 0xA3) return ".webm";
            return null;
        }
    }
}
