import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useState } from "react";

type Props = {
  studentId: string;
  item: string;
  dateBorrow?: string;
  dateReturn?: string;
};


export default function BorrowItem({
  studentId,
  item,
  dateBorrow,
  dateReturn,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <TouchableOpacity onPress={() => setOpen(!open)}>
      <View style={styles.card}>
        <Text>{studentId} - {item}</Text>

        {open && (
          <View style={styles.detail}>
            <Text>ยืม: {dateBorrow}</Text>
            <Text>คืน: {dateReturn}</Text>
          </View>
        )}
      </View>
      <BorrowItem
  studentId="65301234"
  item="Arduino"
  dateBorrow="22/05/69"
  dateReturn="25/05/69"
/>

<BorrowItem
  studentId="65301235"
  item="Sensor"
/>
    </TouchableOpacity>
  );

  
}



const styles = StyleSheet.create({
  card: {
    backgroundColor: "#c7d8e6",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  detail: {
    marginTop: 10,
  },
  
});