#!/bin/sh
# Shim EXEventEmitter.h which was removed from expo-modules-core in SDK 55
# but is still imported by expo-av@16.x
SHIM="node_modules/expo-modules-core/ios/Legacy/Protocols/EXEventEmitter.h"
if [ ! -f "$SHIM" ]; then
  cat > "$SHIM" << 'EOF'
// Copyright © 2018 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>

#import <ExpoModulesCore/EXDefines.h>
#import <ExpoModulesCore/EXExportedModule.h>

@protocol EXEventEmitter

- (void)startObserving;
- (void)stopObserving;

- (NSArray<NSString *> *)supportedEvents;

@end
EOF
  echo "postinstall: created EXEventEmitter.h shim"
fi
