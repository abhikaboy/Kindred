#!/bin/sh
# Shim headers and declarations removed from expo-modules-core in SDK 55
# but still required by expo-av@16.x

LEGACY_DIR="node_modules/expo-modules-core/ios/Legacy/Protocols"
ROOT_DIR="node_modules/expo-modules-core/ios"

# EXEventEmitter.h
SHIM="$LEGACY_DIR/EXEventEmitter.h"
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

# EXEventEmitterService.h
SHIM="$LEGACY_DIR/EXEventEmitterService.h"
if [ ! -f "$SHIM" ]; then
  cat > "$SHIM" << 'EOF'
// Copyright © 2018 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>

#import <ExpoModulesCore/EXDefines.h>
#import <ExpoModulesCore/EXExportedModule.h>

@protocol EXEventEmitterService

- (void)sendEventWithName:(NSString *)name body:(id)body;

@end
EOF
  echo "postinstall: created EXEventEmitterService.h shim"
fi

# EXLegacyExpoViewProtocol.h
SHIM="$ROOT_DIR/EXLegacyExpoViewProtocol.h"
if [ ! -f "$SHIM" ]; then
  cat > "$SHIM" << 'EOF'
// Copyright 2022-present 650 Industries. All rights reserved.

#import <ExpoModulesCore/EXModuleRegistry.h>

@protocol EXLegacyExpoViewProtocol

- (instancetype)initWithModuleRegistry:(nullable EXModuleRegistry *)moduleRegistry;

@end
EOF
  echo "postinstall: created EXLegacyExpoViewProtocol.h shim"
fi

# Patch EXDefines.h to restore EXFatal, EXErrorWithMessage, EXLog* externs
# removed in expo-modules-core@55 but still used by expo-av@16.x
EXDEFINES="$ROOT_DIR/EXDefines.h"
if ! grep -q "EXFatal" "$EXDEFINES"; then
  cat >> "$EXDEFINES" << 'EOF'

// Compatibility externs removed in expo-modules-core@55, required by expo-av@16.x
#pragma mark - Externs

EX_EXTERN void EXLogInfo(NSString *format, ...);
EX_EXTERN void EXLogWarn(NSString *format, ...);
EX_EXTERN void EXLogError(NSString *format, ...);
EX_EXTERN void EXFatal(NSError *);
EX_EXTERN NSError * EXErrorWithMessage(NSString *);

#if TARGET_OS_OSX
EX_EXTERN NSApplication *EXSharedApplication(void);
#else
EX_EXTERN UIApplication *EXSharedApplication(void);
#endif
EOF
  echo "postinstall: patched EXDefines.h with missing externs"
fi
