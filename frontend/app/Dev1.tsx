import { View, Text, Dimensions } from 'react-native'
import React from 'react'
import { ThemedText } from '@/components/ThemedText'
import { Colors } from '@/constants/Colors'
import PrimaryButton from '@/components/buttons/PrimaryButton'

export default function Dev1() {
  return (
    <View style={{
        backgroundColor: Colors.dark.background,
        height: Dimensions.get("screen").height,
        flex: 1,
        paddingTop: Dimensions.get("screen").height * 0.1,
        paddingHorizontal: 24,
        gap: 16,
    }}>
      <ThemedText type='title' style={{fontWeight: "700"}}>
        Development Components 1
      </ThemedText>
      <PrimaryButton title='Button' onPress={() => {}}/>
    </View>
  )
}