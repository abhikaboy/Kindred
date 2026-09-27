import Intents
import UserNotifications

/// Rewrites incoming pushes as iOS "communication notifications" so they render
/// like a message from a person: the sender's avatar in the leading icon slot
/// and their display name as the title, instead of the Kindred app icon.
///
/// This requires the `com.apple.developer.usernotifications.communication`
/// entitlement on the host app and `mutableContent` on the push payload. A push
/// that omits the sender fields is passed through untouched, so notification
/// types without a human actor (rings closed, kudos suggestions) still deliver
/// normally.
class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler

        guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
            contentHandler(request.content)
            return
        }
        bestAttempt = content

        // Expo delivers the `data` map either at the top level or nested under
        // "body" depending on SDK version, so check both rather than assuming.
        // userInfo is [AnyHashable: Any], so the top-level fallback needs its
        // keys narrowed to strings before it can stand in for the nested map.
        let userInfo = content.userInfo
        var data: [String: Any] = [:]
        if let body = userInfo["body"] as? [String: Any] {
            data = body
        } else {
            for (key, value) in userInfo {
                guard let name = key as? String else { continue }
                data[name] = value
            }
        }

        guard let senderName = data["senderName"] as? String, !senderName.isEmpty else {
            contentHandler(content)
            return
        }
        let senderID = data["senderId"] as? String
        let avatarURL = (data["senderAvatar"] as? String).flatMap(URL.init(string:))

        loadAvatar(from: avatarURL) { [weak self] image in
            guard let self else { return }
            contentHandler(self.communicationContent(
                from: content,
                senderName: senderName,
                senderID: senderID,
                avatar: image
            ))
        }
    }

    /// The system gives the extension ~30s; if the avatar download outlives that
    /// budget, deliver the unmodified notification rather than dropping it.
    override func serviceExtensionTimeWillExpire() {
        if let contentHandler, let bestAttempt {
            contentHandler(bestAttempt)
        }
    }

    private func communicationContent(
        from content: UNMutableNotificationContent,
        senderName: String,
        senderID: String?,
        avatar: INImage?
    ) -> UNNotificationContent {
        let handle = INPersonHandle(value: senderID ?? senderName, type: .unknown)
        let sender = INPerson(
            personHandle: handle,
            nameComponents: nil,
            displayName: senderName,
            image: avatar,
            contactIdentifier: nil,
            customIdentifier: senderID
        )

        let intent = INSendMessageIntent(
            recipients: nil,
            outgoingMessageType: .outgoingMessageText,
            content: content.body,
            speakableGroupName: nil,
            // Grouping by sender makes repeat notifications from the same person
            // thread together in Notification Center.
            conversationIdentifier: senderID,
            serviceName: nil,
            sender: sender,
            attachments: nil
        )
        intent.setImage(avatar, forParameterNamed: \.sender)

        // The donation is what teaches the system this is a person-to-person
        // message; without it `updating(from:)` has no effect.
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate(completion: nil)

        do {
            return try content.updating(from: intent)
        } catch {
            return content
        }
    }

    private func loadAvatar(from url: URL?, completion: @escaping (INImage?) -> Void) {
        guard let url else {
            completion(nil)
            return
        }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            completion(data.map { INImage(imageData: $0) })
        }.resume()
    }
}
