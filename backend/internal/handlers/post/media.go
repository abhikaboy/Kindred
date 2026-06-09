package Post

import "github.com/abhikaboy/Kindred/internal/handlers/types"

// ToMediaItems converts request inputs into stored media items.
func ToMediaItems(in []MediaItemInput) []types.MediaItem {
	if len(in) == 0 {
		return nil
	}
	out := make([]types.MediaItem, 0, len(in))
	for _, m := range in {
		out = append(out, types.MediaItem{
			Type:         m.Type,
			URL:          m.URL,
			ThumbnailURL: m.ThumbnailURL,
			Width:        m.Width,
			Height:       m.Height,
			DurationMs:   m.DurationMs,
			Bytes:        m.Bytes,
		})
	}
	return out
}

// DeriveImagesFromMedia returns the URLs of image-type items, preserving order,
// so legacy `Images` readers keep working.
func DeriveImagesFromMedia(media []types.MediaItem) []string {
	var imgs []string
	for _, m := range media {
		if m.Type == "image" {
			imgs = append(imgs, m.URL)
		}
	}
	return imgs
}

// PrimarySizeFromMedia returns dimensions of the first media item, if any.
func PrimarySizeFromMedia(media []types.MediaItem) *types.ImageSize {
	if len(media) == 0 {
		return nil
	}
	first := media[0]
	if first.Width == 0 && first.Height == 0 {
		return nil
	}
	return &types.ImageSize{Width: first.Width, Height: first.Height, Bytes: first.Bytes}
}
