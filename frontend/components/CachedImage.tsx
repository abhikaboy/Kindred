import React from 'react';
import { Image, ImageProps, ImageURISource } from 'expo-image';
import { View, StyleSheet } from 'react-native';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  source: ImageURISource;
  fallbackSource?: ImageURISource;
  placeholder?: React.ReactNode;
  cachePolicy?: 'memory' | 'disk' | 'memory-disk';
}

const CachedImage: React.FC<CachedImageProps> = ({
  source,
  fallbackSource,
  placeholder,
  cachePolicy = 'memory-disk',
  style,
  ...props
}) => {
  return (
    <Image
      source={source}
      placeholder={placeholder}
      contentFit="cover"
      transition={200}
      cachePolicy={cachePolicy}
      style={[styles.image, style]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});

export default CachedImage;
