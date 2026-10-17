// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "NioSafariBootstrap",
    platforms: [.macOS(.v13)],
    products: [.library(name: "SafariNativeIPC", targets: ["SafariNativeIPC"])],
    targets: [
        .target(name: "SafariNativeIPC"),
        .testTarget(name: "SafariNativeIPCTests", dependencies: ["SafariNativeIPC"]),
    ]
)
