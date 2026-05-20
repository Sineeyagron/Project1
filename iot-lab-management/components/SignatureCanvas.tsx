import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
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
  onDrawingChange?: (isDrawing: boolean) => void;
};

const CANVAS_W = 320;
const CANVAS_H = 180;

const SignatureCanvas = forwardRef<SignatureCanvasRef, Props>(
  (
    {
      strokeColor = "#1a1a2e",
      strokeWidth = 2.5,
      backgroundColor = "#f8f9ff",
      style,
      onBegin,
      onDrawingChange,
    },
    ref
  ) => {
    const [donePaths, setDonePaths] = useState<string[]>([]);
    const [activePath, setActivePath] = useState("");
    const current = useRef("");
    const started = useRef(false);

    // ใช้ ref สำหรับ callback เพื่อหลีกเลี่ยง stale closure ใน PanResponder
    const onBeginRef = useRef(onBegin);
    const onDrawingChangeRef = useRef(onDrawingChange);
    useEffect(() => { onBeginRef.current = onBegin; });
    useEffect(() => { onDrawingChangeRef.current = onDrawingChange; });

    // เก็บ strokeColor ใน ref เพื่อใช้ใน getSvgString
    const strokeColorRef = useRef(strokeColor);
    useEffect(() => { strokeColorRef.current = strokeColor; });

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
              `<path d="${d}" stroke="${strokeColorRef.current}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
          )
          .join("");
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" style="background:${backgroundColor}">${pathEls}</svg>`;
      },
    }));

    const pan = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (e) => {
          onDrawingChangeRef.current?.(true);
          if (!started.current) {
            started.current = true;
            onBeginRef.current?.();
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
          const path = current.current;
          current.current = "";
          if (path) {
            setDonePaths((prev) => [...prev, path]);
            setActivePath("");
          }
          onDrawingChangeRef.current?.(false);
        },
        onPanResponderTerminate: () => {
          const path = current.current;
          current.current = "";
          if (path) {
            setDonePaths((prev) => [...prev, path]);
            setActivePath("");
          }
          onDrawingChangeRef.current?.(false);
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
        collapsable={false}
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

SignatureCanvas.displayName = "SignatureCanvas";

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
