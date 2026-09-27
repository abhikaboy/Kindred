{
  description = "Kindred App";

  inputs = {
    devenv = {
      inputs.nixpkgs.follows = "nixpkgs";
      url = "github:cachix/devenv";
    };
    env-help = {
      inputs.nixpkgs.follows = "nixpkgs";
      url = "github:jtrrll/env-help";
    };
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    # Bun is pinned separately: the main nixpkgs lock is old enough to ship
    # bun 1.1.x, which cannot parse the text-format frontend/bun.lock
    # (requires bun >= 1.2). Kept as its own input so bumping bun does not
    # drag Go, Node, and the rest of the toolchain along with it.
    nixpkgs-bun.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = {flake-parts, ...} @ inputs:
    flake-parts.lib.mkFlake {inherit inputs;} {
      imports = [./nix_modules];
    };
}