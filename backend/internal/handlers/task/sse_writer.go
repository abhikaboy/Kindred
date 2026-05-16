package task

import (
	"bufio"
	"encoding/json"
	"fmt"
)

// SSEWriter writes Server-Sent Events to a buffered writer with flushing.
type SSEWriter struct {
	w *bufio.Writer
}

// NewSSEWriter wraps a bufio.Writer for SSE output.
func NewSSEWriter(w *bufio.Writer) *SSEWriter {
	return &SSEWriter{w: w}
}

// Send writes a single SSE event (event + JSON-encoded data) and flushes.
func (s *SSEWriter) Send(event string, data interface{}) error {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("sse marshal: %w", err)
	}
	if _, err := fmt.Fprintf(s.w, "event: %s\ndata: %s\n\n", event, jsonBytes); err != nil {
		return err
	}
	return s.w.Flush()
}

// SendError writes an error event and flushes.
func (s *SSEWriter) SendError(message string) error {
	return s.Send("error", map[string]string{"message": message})
}
