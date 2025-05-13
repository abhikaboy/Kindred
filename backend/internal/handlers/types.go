package handlers

type RecurMode string

const (
	RecurModeOccurence RecurMode = "occurence"
	RecurModeDeadline RecurMode = "deadline"
	RecurModeWindow   RecurMode = "window"
)