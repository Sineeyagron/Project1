import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { PanResponder, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

export type SignatureCanvasRef = {
  clear: () => void;
  isEmpty: () => boolean;
  getSvgString: () => string;
};

type Props = {
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  style?: ViewStyle;
  onBegin?: () => void;
};

const CANVAS_W = 340;
const CANVAS_H = 180;

const SignatureCanvas = forwardRef<SignatureCanvasRef, Props>(
  (
    {
      strokeColor = "#1a1a2e",
      strokeWidth = 2.5,
      backgroundColor = "#f8f9ff",
      style,
      onBegin,
    },
    ref
  ) => {
    const [donePaths, setDonePaths] = useState<string[]>([]);
    const [activePath, setActivePath] = useState("");
    const current = useRef("");
    const started = useRef(false);

    useImperativeHandle(ref, () => ({
      clear: () => {
        setDonePaths([]);
        setActivePath("");
        current.current = "";
        started.current = false;
      },
      isEmpty: () => donePaths.length === 0 && activePath === "",
      getSvgString: () => {
        const allPaths = [...donePaths, activePath].filter(Boolean);
        const pathEls = allPaths
          .map(
            (d) =>
              `<path d="${d}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
          )
          .join("");
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" style="background:${backgroundColor}">${pathEls}</svg>`;
      },
    }));

    const pan = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          if (!started.current) {
            started.current = true;
            onBegin?.();
          }
          const { locationX: x, locationY: y } = e.nativeEvent;
          current.current = `M${x.toFixed(1)},${y.toFixed(1)}`;
          setActivePath(current.current);
        },
        onPanResponderMove: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          current.current += ` L${x.toFixed(1)},${y.toFixed(1)}`;
          setActivePath(current.current);
        },
        onPanResponderRelease: () => {
          if (current.current) {
            setDonePaths((prev) => [...prev, current.current]);
            setActivePath("");
            current.current = "";
          }
        },
      })
    ).current;

    return (
      <View
        style={[
          styles.canvas,
          { backgroundColor, width: CANVAS_W, height: CANVAS_H },
          style,
        ]}
        {...pan.panHandlers}
      >
        <Svg width={CANVAS_W} height={CANVAS_H}>
          {donePaths.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {activePath ? (
            <Path
              d={activePath}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
      </View>
    );
  }
);

export default SignatureCanvas;

const styles = StyleSheet.create({
  canvas: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#dde3f0",
    borderStyle: "dashed",
  },
});
