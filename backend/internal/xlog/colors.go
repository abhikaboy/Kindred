package xlog

import (
	"fmt"
	"log/slog"
	"os"
)

// ANSI color codes
const (
	Reset  = "\033[0m"
	Red    = "\033[31m"
	Green  = "\033[32m"
	Yellow = "\033[33m"
	Blue   = "\033[34m"
	Purple = "\033[35m"
	Cyan   = "\033[36m"
	White  = "\033[37m"

	// Background colors
	BgRed    = "\033[41m"
	BgGreen  = "\033[42m"
	BgYellow = "\033[43m"
	BgBlue   = "\033[44m"
	BgPurple = "\033[45m"
	BgCyan   = "\033[46m"

	// Text styles
	Bold      = "\033[1m"
	Dim       = "\033[2m"
	Italic    = "\033[3m"
	Underline = "\033[4m"
)

// Check if we should use colors (only in terminal)
func shouldUseColors() bool {
	// Check if stdout is a terminal
	stat, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return (stat.Mode() & os.ModeCharDevice) != 0
}

// Color wraps text with the specified color only if terminal supports it
func Color(color, text string) string {
	if shouldUseColors() {
		return color + text + Reset
	}
	return text
}

// Colored logging helpers
func RedText(text string) string    { return Color(Red, text) }
func GreenText(text string) string  { return Color(Green, text) }
func YellowText(text string) string { return Color(Yellow, text) }
func BlueText(text string) string   { return Color(Blue, text) }
func PurpleText(text string) string { return Color(Purple, text) }
func CyanText(text string) string   { return Color(Cyan, text) }
func WhiteText(text string) string  { return Color(White, text) }

// Bold colored text
func BoldRed(text string) string    { return Color(Bold+Red, text) }
func BoldGreen(text string) string  { return Color(Bold+Green, text) }
func BoldYellow(text string) string { return Color(Bold+Yellow, text) }
func BoldBlue(text string) string   { return Color(Bold+Blue, text) }
func BoldPurple(text string) string { return Color(Bold+Purple, text) }
func BoldCyan(text string) string   { return Color(Bold+Cyan, text) }

// Specific logging themes (simplified to avoid double coloring)
func AuthLog(msg string) {
	slog.Info("🔐 AUTH: " + msg)
}

func AuthSuccess(msg string) {
	slog.Info("✅ AUTH SUCCESS: " + msg)
}

func AuthError(msg string) {
	slog.Error("❌ AUTH ERROR: " + msg)
}

func ValidationLog(msg string) {
	slog.Info("🔍 VALIDATION: " + msg)
}

func RequestLog(method, path string) {
	slog.Info(fmt.Sprintf("🌐 %s %s", method, path))
}

func ServerLog(msg string) {
	slog.Info("🔧 SERVER: " + msg)
}

func RefreshLog(msg string) {
	slog.Info("🔄 REFRESH: " + msg)
}

func SuccessLog(msg string) {
	slog.Info("✅ SUCCESS: " + msg)
}

func ErrorLog(msg string) {
	slog.Error("❌ ERROR: " + msg)
}

func CompletionLog(msg string) {
	slog.Info("🎯 COMPLETE: " + msg)
}

// Database operation colors
func DBLog(msg string) {
	slog.Info("💾 DB: " + msg)
}

func DBSuccess(msg string) {
	slog.Info("✅ DB SUCCESS: " + msg)
}

func DBError(msg string) {
	slog.Error("❌ DB ERROR: " + msg)
}

// HTTP status code colors
func StatusColor(code int) string {
	switch {
	case code >= 200 && code < 300:
		return Green
	case code >= 300 && code < 400:
		return Yellow
	case code >= 400 && code < 500:
		return Red
	case code >= 500:
		return BgRed + White
	default:
		return Reset
	}
}

func LogWithStatus(msg string, code int) {
	coloredCode := Color(StatusColor(code), fmt.Sprintf("%d", code))
	slog.Info(fmt.Sprintf("%s [%s]", msg, coloredCode))
}
