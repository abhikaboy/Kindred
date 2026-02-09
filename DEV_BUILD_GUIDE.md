# Development Build Guide for Google OAuth Testing

## Why Development Build Instead of Expo Go?

**Google OAuth does NOT work in Expo Go** because:
- Google requires HTTPS or native URL schemes for OAuth redirects
- Expo Go uses `exp://` scheme which Google rejects for sensitive scopes
- Development builds use your app's native URL scheme and work correctly

## Quick Start: Build and Install

### 1. Build for iOS Simulator (Fastest for Testing)

```bash
cd frontend

# Build for iOS Simulator
eas build --platform ios --profile development --local

# Or build on EAS servers (slower but no local setup needed)
eas build --platform ios --profile development
```

**Build time**:
- Local build: ~5-10 minutes (requires Xcode)
- EAS cloud build: ~15-20 minutes

### 2. Install the Build

**For Simulator Build:**
```bash
# After build completes, you'll get a .app or .tar.gz file
# Drag the .app file to your iOS Simulator
# Or use:
xcrun simctl install booted path/to/your-app.app
```

**For Device Build:**
- Download the `.ipa` file from EAS dashboard
- Install via Xcode: Window → Devices and Simulators → drag .ipa file
- Or use Apple Configurator

### 3. Start Development Server

```bash
cd frontend
npx expo start --dev-client
```

### 4. Open Your App

- Open the development build on your device/simulator
- It will connect to your local Metro bundler
- You can now test Google OAuth!

## Development Workflow

### Making Code Changes

1. **Keep Metro running**: `npx expo start --dev-client`
2. **Edit your code**: Changes hot reload automatically
3. **Test features**: Including Google OAuth, push notifications, etc.

### When to Rebuild

You need to rebuild when you change:
- ✅ `app.json` configuration
- ✅ Native dependencies (new packages)
- ✅ iOS/Android native code
- ❌ JavaScript/TypeScript code (hot reloads automatically)

## Testing Google OAuth

Once your development build is installed:

### Registration Flow
1. Open your app
2. Tap "Continue with Google"
3. Google OAuth screen opens in Safari
4. Authenticate with Google
5. Redirects back to your app using: `com.googleusercontent.apps.955300435674-4unacg9mbosj1sdf3gqb17lb6rasqmj6://`
6. User is created in backend
7. Navigate to onboarding

### Login Flow
1. Tap "Sign in with Google"
2. Authenticate
3. Redirect back to app
4. Navigate to main screen

## Build Profiles Explained

Your `eas.json` has three profiles:

### `development` (Current Use)
- **Purpose**: Testing with hot reload
- **Distribution**: Internal (direct install)
- **Features**: Development client, fast refresh, debugging
- **Use for**: Google OAuth testing, feature development

### `preview`
- **Purpose**: Pre-production testing
- **Distribution**: Internal (TestFlight or direct)
- **Features**: Production-like but not optimized
- **Use for**: QA testing, stakeholder demos

### `production`
- **Purpose**: App Store submission
- **Distribution**: App Store
- **Features**: Fully optimized, no dev tools
- **Use for**: Public releases

## Troubleshooting

### Build fails with "Xcode not found"
- Install Xcode from Mac App Store
- Run: `sudo xcode-select --switch /Applications/Xcode.app`

### "No development build found"
- Make sure you built with `--profile development`
- Check the build completed successfully on EAS dashboard

### Google OAuth still doesn't work
- Verify URL scheme in `app.json`: `com.googleusercontent.apps.955300435674-4unacg9mbosj1sdf3gqb17lb6rasqmj6`
- Rebuild after any `app.json` changes
- Check Google Console has correct bundle ID: `com.kindred.kindredtsl`

### App won't connect to Metro
- Ensure device/simulator is on same network as your computer
- Try: `npx expo start --dev-client --tunnel` (slower but works across networks)
- Check firewall settings

## Quick Commands Reference

```bash
# Build for iOS Simulator (local)
eas build --platform ios --profile development --local

# Build for iOS Device (cloud)
eas build --platform ios --profile development

# Build for Android
eas build --platform android --profile development

# Start development server
npx expo start --dev-client

# Start with tunnel (for different networks)
npx expo start --dev-client --tunnel

# Check build status
eas build:list

# View build logs
eas build:view [BUILD_ID]
```

## Next Steps After First Build

1. ✅ Install development build
2. ✅ Test Google OAuth registration
3. ✅ Test Google OAuth login
4. ✅ Test error cases (unregistered account, cancel flow)
5. ✅ Verify timezone capture during registration
6. ✅ Test with multiple Google accounts

## Tips for Faster Development

1. **Use Simulator builds** for quick testing (no device needed)
2. **Keep Metro running** - only restart when needed
3. **Use local builds** if you have Xcode (much faster)
4. **Cache builds** - EAS caches dependencies between builds
5. **Test in Expo Go first** for non-OAuth features

## Cost Considerations

- **EAS Builds**: Free tier includes limited builds per month
- **Local Builds**: Unlimited but requires Mac with Xcode
- **Development Builds**: Count against your EAS quota
- **Tip**: Use local builds for development, cloud builds for distribution

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Dashboard](https://expo.dev/accounts/suntex/projects/Kindred/builds)
