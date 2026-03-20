import { TouchableOpacity, Text, StyleSheet } from "react-native";

type Props = {
  name: string;
  onPress: () => void;
};

export default function RoomCard({ name, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Text style={styles.text}>{name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#bcd0df",
    padding: 40,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  text: {
    fontSize: 28,
  },
});