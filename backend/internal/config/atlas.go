package config

import "fmt"

type Atlas struct {
	User        string `env:"USER"`
	Pass        string `env:"PASS"`
	Cluster     string `env:"CLUSTER"`
	Environment string `env:"ENVIRONMENT"`
}

const placeholderURI string = "mongodb+srv://%s:%s@%s.q2lnn.mongodb.net/"

func (a *Atlas) URI() string {
	return fmt.Sprintf(placeholderURI, a.User, a.Pass, a.Cluster)
}
