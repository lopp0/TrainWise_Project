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
        public const long MaxBytes = 6 * 1024 * 1024; // 6 MB

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
    }
}
