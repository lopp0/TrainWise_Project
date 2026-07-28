import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Line, Path, Circle, Text as SvgText } from 'react-native-svg';
import { Colors, Fonts } from '../theme/colors';

/**
 * AC-ratio trend chart, drawn directly with react-native-svg so the sweet-spot
 * band, threshold lines and zone labels are exact (chart-kit cannot shade a
 * horizontal band). Deliberately minimal: one line, one green band, three
 * plain-language zone labels. The Y axis is labeled at the THRESHOLDS
 * (0.8 / 1.3 / 1.5) because those are the numbers that mean something to the
 * user, not arbitrary round ticks.
 *
 * props:
 *   series   [{ date: ISO string, ratio: number|null, level: 'Green'|... }]
 *   safeLow / safeHigh / overload   zone thresholds (0.8 / 1.3 / 1.5)
 *   width / height                  pixel size of the whole chart
 */
const PAD_LEFT = 34;
const PAD_RIGHT = 10;
const PAD_TOP = 22;
const PAD_BOTTOM = 22;

const levelColor = (level) => {
  if (level === 'Red') return Colors.red;
  if (level === 'Yellow') return Colors.yellow;
  return Colors.green;
};

const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
};

const AcwrTrendChart = ({
  series = [],
  safeLow = 0.8,
  safeHigh = 1.3,
  overload = 1.5,
  width = 300,
  height = 190,
}) => {
  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const points = series.filter((p) => p != null);
  const n = points.length;

  // Y scale: always show at least 0..2 so the band sits in a stable place;
  // grow (capped at 3) if the data spikes higher. Values above the cap are
  // clamped so one wild early ratio can't squash the whole chart.
  const maxRatio = points.reduce(
    (m, p) => (p.ratio != null && p.ratio > m ? p.ratio : m),
    0,
  );
  const yMax = Math.min(3, Math.max(2, Math.ceil(maxRatio * 2) / 2));
  const y = (v) => PAD_TOP + plotH * (1 - Math.min(v, yMax) / yMax);
  const x = (i) => PAD_LEFT + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));

  // Line path, breaking on days where the ratio is not defined yet.
  let path = '';
  let pen = false;
  points.forEach((p, i) => {
    if (p.ratio == null) {
      pen = false;
      return;
    }
    path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.ratio).toFixed(1)} `;
    pen = true;
  });

  const last = [...points].reverse().find((p) => p.ratio != null);
  const lastIdx = last ? points.lastIndexOf(last) : -1;

  // 4 evenly spaced date labels.
  const labelIdx =
    n > 3 ? [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1] : [0, n - 1];

  const bandTop = y(safeHigh);
  const bandBottom = y(safeLow);
  const zoneLabelX = PAD_LEFT + 6;

  return (
    <View>
      <Svg width={width} height={height}>
        {/* zone tints: soft red above the sweet spot, green band, plain below */}
        <Rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={plotW}
          height={Math.max(bandTop - PAD_TOP, 0)}
          fill={`${Colors.red}10`}
        />
        <Rect
          x={PAD_LEFT}
          y={bandTop}
          width={plotW}
          height={Math.max(bandBottom - bandTop, 0)}
          fill={`${Colors.green}20`}
        />

        {/* threshold lines + labels on the Y axis */}
        {[
          { v: safeHigh, label: safeHigh.toFixed(1) },
          { v: safeLow, label: safeLow.toFixed(1) },
        ].map(({ v, label }) => (
          <React.Fragment key={label}>
            <Line
              x1={PAD_LEFT}
              y1={y(v)}
              x2={width - PAD_RIGHT}
              y2={y(v)}
              stroke={Colors.border}
              strokeWidth={1}
            />
            <SvgText
              x={PAD_LEFT - 6}
              y={y(v) + 4}
              fill={Colors.textSecondary}
              fontSize={Fonts.captionSize - 1}
              textAnchor="end">
              {label}
            </SvgText>
          </React.Fragment>
        ))}
        {overload < yMax && (
          <>
            <Line
              x1={PAD_LEFT}
              y1={y(overload)}
              x2={width - PAD_RIGHT}
              y2={y(overload)}
              stroke={Colors.red}
              strokeWidth={1}
              strokeDasharray="5,4"
              opacity={0.6}
            />
            <SvgText
              x={PAD_LEFT - 6}
              y={y(overload) + 4}
              fill={Colors.red}
              fontSize={Fonts.captionSize - 1}
              textAnchor="end"
              opacity={0.8}>
              {overload.toFixed(1)}
            </SvgText>
          </>
        )}

        {/* plain-language zone labels */}
        <SvgText
          x={zoneLabelX}
          y={(PAD_TOP + bandTop) / 2 + 4}
          fill={Colors.red}
          fontSize={Fonts.captionSize - 1}
          opacity={0.75}>
          pushing too hard
        </SvgText>
        <SvgText
          x={zoneLabelX}
          y={(bandTop + bandBottom) / 2 + 4}
          fill={Colors.green}
          fontSize={Fonts.captionSize - 1}
          opacity={0.9}>
          sweet spot
        </SvgText>
        <SvgText
          x={zoneLabelX}
          y={(bandBottom + height - PAD_BOTTOM) / 2 + 4}
          fill={Colors.textMuted}
          fontSize={Fonts.captionSize - 1}
          opacity={0.9}>
          easing off
        </SvgText>

        {/* baseline (x axis) */}
        <Line
          x1={PAD_LEFT}
          y1={height - PAD_BOTTOM}
          x2={width - PAD_RIGHT}
          y2={height - PAD_BOTTOM}
          stroke={Colors.border}
          strokeWidth={1}
        />

        {/* the ratio line */}
        {path !== '' && (
          <Path d={path} stroke={Colors.primary} strokeWidth={2.5} fill="none" />
        )}

        {/* today: emphasized dot in the current level color + value bubble */}
        {last && lastIdx >= 0 && (
          <>
            <Circle
              cx={x(lastIdx)}
              cy={y(last.ratio)}
              r={5}
              fill={levelColor(last.level)}
              stroke={Colors.cardBackground}
              strokeWidth={2}
            />
            <SvgText
              x={Math.min(x(lastIdx), width - PAD_RIGHT - 18)}
              y={Math.max(y(last.ratio) - 10, 12)}
              fill={Colors.textPrimary}
              fontSize={Fonts.captionSize}
              fontWeight="700"
              textAnchor="middle">
              {last.ratio.toFixed(2)}
            </SvgText>
          </>
        )}

        {/* date labels */}
        {labelIdx.map((i) =>
          points[i] ? (
            <SvgText
              key={i}
              x={Math.max(PAD_LEFT + 14, Math.min(x(i), width - PAD_RIGHT - 16))}
              y={height - 6}
              fill={Colors.textMuted}
              fontSize={Fonts.captionSize - 1}
              textAnchor="middle">
              {fmtDate(points[i].date)}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
};

export default AcwrTrendChart;
