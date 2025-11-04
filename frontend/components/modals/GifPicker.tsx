import React, { useState, useEffect } from 'react';
import {
    View,
    TextInput,
    FlatList,
    TouchableOpacity,
    Image,
    StyleSheet,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_SIZE = (SCREEN_WIDTH - 40) / 2; // 2 columns with padding
const RECENT_GIFS_KEY = 'recent_gifs';
const MAX_RECENT_GIFS = 4;

interface GifPickerProps {
    onGifSelect: (gifUrl: string) => void;
}

interface RecentGif {
    id: string;
    url: string;
    previewUrl: string;
}

export default function GifPicker({ onGifSelect }: GifPickerProps) {
    const ThemedColor = useThemeColor();
    const [searchQuery, setSearchQuery] = useState('');
    const [gifs, setGifs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [featuredGifs, setFeaturedGifs] = useState<any[]>([]);
    const [recentGifs, setRecentGifs] = useState<RecentGif[]>([]);

    const TENOR_API_KEY = process.env.EXPO_PUBLIC_TENOR_API_KEY || '';
    const TENOR_CLIENT_KEY = 'kindred_app';

    // Load featured GIFs and recent GIFs on mount
    useEffect(() => {
        loadFeaturedGifs();
        loadRecentGifs();
    }, []);

    // Search GIFs when query changes
    useEffect(() => {
        if (searchQuery.trim()) {
            const timeoutId = setTimeout(() => {
                searchGifs(searchQuery);
            }, 500);
            return () => clearTimeout(timeoutId);
        } else {
            setGifs([]);
        }
    }, [searchQuery]);

    const loadRecentGifs = async () => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_GIFS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setRecentGifs(parsed);
            }
        } catch (error) {
            console.error('Error loading recent GIFs:', error);
        }
    };

    const saveRecentGif = async (gif: any) => {
        try {
            const gifUrl = gif?.media_formats?.gif?.url || gif?.media_formats?.tinygif?.url;
            const previewUrl = gif?.media_formats?.tinygif?.url || gif?.media_formats?.gif?.url;
            
            if (!gifUrl || !previewUrl) return;

            const newRecentGif: RecentGif = {
                id: gif.id,
                url: gifUrl,
                previewUrl: previewUrl,
            };

            // Get current recent GIFs
            const stored = await AsyncStorage.getItem(RECENT_GIFS_KEY);
            let currentRecents: RecentGif[] = stored ? JSON.parse(stored) : [];

            // Remove the gif if it already exists (to move it to the front)
            currentRecents = currentRecents.filter(g => g.id !== newRecentGif.id);

            // Add new gif to the beginning
            currentRecents.unshift(newRecentGif);

            // Keep only the most recent MAX_RECENT_GIFS
            currentRecents = currentRecents.slice(0, MAX_RECENT_GIFS);

            // Save to AsyncStorage
            await AsyncStorage.setItem(RECENT_GIFS_KEY, JSON.stringify(currentRecents));

            // Update state
            setRecentGifs(currentRecents);
        } catch (error) {
            console.error('Error saving recent GIF:', error);
        }
    };

    const loadFeaturedGifs = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=20&contentfilter=low`
            );
            const data = await response.json();
            setFeaturedGifs(data.results || []);
        } catch (error) {
            console.error('Error loading featured GIFs:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchGifs = async (query: string) => {
        setLoading(true);
        try {
            const response = await fetch(
                `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(
                    query
                )}&key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=20&contentfilter=low`
            );
            const data = await response.json();
            setGifs(data.results || []);
        } catch (error) {
            console.error('Error searching GIFs:', error);
            setGifs([]);
        } finally {
            setLoading(false);
        }
    };

    const handleGifPress = async (gif: any) => {
        // Get the GIF URL (using the gif format for best quality)
        const gifUrl = gif?.media_formats?.gif?.url || gif?.media_formats?.tinygif?.url;
        if (gifUrl) {
            // Save to recent GIFs
            await saveRecentGif(gif);
            onGifSelect(gifUrl);
        }
    };

    const handleRecentGifPress = async (recentGif: RecentGif) => {
        onGifSelect(recentGif.url);
    };

    const displayGifs = searchQuery.trim() ? gifs : featuredGifs;

    const renderGif = ({ item }: { item: any }) => {
        const previewUrl = item?.media_formats?.tinygif?.url || item?.media_formats?.gif?.url;
        
        return (
            <TouchableOpacity
                style={styles.gifContainer}
                onPress={() => handleGifPress(item)}
                activeOpacity={0.7}
            >
                <Image
                    source={{ uri: previewUrl }}
                    style={styles.gifImage}
                    resizeMode="cover"
                />
            </TouchableOpacity>
        );
    };

    const renderRecentGif = ({ item }: { item: RecentGif }) => {
        return (
            <TouchableOpacity
                style={styles.recentGifContainer}
                onPress={() => handleRecentGifPress(item)}
                activeOpacity={0.7}
            >
                <Image
                    source={{ uri: item.previewUrl }}
                    style={styles.recentGifImage}
                    resizeMode="cover"
                />
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
            <View style={[styles.searchContainer, { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.tertiary }]}>
                <TextInput
                    style={[styles.searchInput, { color: ThemedColor.text }]}
                    placeholder="Search GIFs..."
                    placeholderTextColor={ThemedColor.caption}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={ThemedColor.primary} />
                </View>
            ) : (
                <>
                    {!searchQuery.trim() && recentGifs.length > 0 && (
                        <View style={styles.recentSection}>
                            <View style={styles.headerContainer}>
                                <ThemedText type="defaultSemiBold" style={styles.headerText}>
                                    Recently Used
                                </ThemedText>
                            </View>
                            <FlatList
                                data={recentGifs}
                                renderItem={renderRecentGif}
                                keyExtractor={(item) => item.id}
                                horizontal
                                contentContainerStyle={styles.recentListContent}
                                showsHorizontalScrollIndicator={false}
                            />
                        </View>
                    )}
                    
                    {!searchQuery.trim() && (
                        <View style={styles.headerContainer}>
                            <ThemedText type="defaultSemiBold" style={styles.headerText}>
                                Featured GIFs
                            </ThemedText>
                        </View>
                    )}
                    <FlatList
                        data={displayGifs}
                        renderItem={renderGif}
                        keyExtractor={(item, index) => item.id || index.toString()}
                        numColumns={2}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={true}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <ThemedText type="lightBody" style={styles.emptyText}>
                                    {searchQuery.trim() ? 'No GIFs found' : 'Loading...'}
                                </ThemedText>
                            </View>
                        }
                    />
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    searchContainer: {
        margin: 16,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        height: 45,
        justifyContent: 'center',
    },
    searchInput: {
        fontSize: 16,
        fontFamily: 'Outfit',
    },
    recentSection: {
        marginBottom: 16,
    },
    headerContainer: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    headerText: {
        fontSize: 16,
    },
    recentListContent: {
        paddingHorizontal: 12,
    },
    recentGifContainer: {
        width: 120,
        height: 120,
        marginHorizontal: 4,
        borderRadius: 8,
        overflow: 'hidden',
    },
    recentGifImage: {
        width: '100%',
        height: '100%',
    },
    listContent: {
        padding: 8,
    },
    gifContainer: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        margin: 4,
        borderRadius: 8,
        overflow: 'hidden',
    },
    gifImage: {
        width: '100%',
        height: '100%',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },
});

