import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

interface Props {
  /** One color per real (non-"add") page, in order. */
  dotColors: string[];
  activeIndex: number;
  /** Whether the currently active page is the trailing "add computer" page. */
  onAddPage: boolean;
}

export function PageDots({ dotColors, activeIndex, onAddPage }: Props) {
  if (dotColors.length === 0) return null;

  return (
    <View style={styles.row} pointerEvents="none">
      {dotColors.map((color, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            { backgroundColor: color },
            index === activeIndex && !onAddPage && styles.dotActive,
          ]}
        />
      ))}
      <View style={[styles.dot, styles.addDot, onAddPage && styles.dotActive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    paddingVertical: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.5,
  },
  dotActive: {
    opacity: 1,
    transform: [{ scale: 1.3 }],
  },
  addDot: {
    backgroundColor: colors.textFaint,
  },
});
