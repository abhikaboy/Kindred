import { Text } from 'react-native'
import React from 'react'
import { ThemedView } from '@/components/ThemedView'
import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ThemedText } from '@/components/ThemedText'

const Friends = () => {
    const { id } = useLocalSearchParams()
    

    if (isLoading) return <ThemedView><ThemedText>Loading...</ThemedText></ThemedView>
    if (error) return <ThemedView><ThemedText>Error: {error.message}</ThemedText></ThemedView>

  return (
    <ThemedView>
      <Text>Friends</Text>
    </ThemedView>
  )
}

export default Friends