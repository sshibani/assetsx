# AssetX Glossary

This glossary defines every object used in the AssetX system. Each object has its
own file under `docs/glossary/` with its **name** and a **description** of what it
represents and how it is used.

## Data models (persisted in the database)

| Object | Description |
|---|---|
| [User](./User.md) | A durable internal identity that can authenticate and belong to accounts. |
| [Account](./Account.md) | The tenant boundary that owns assets, members, and settings. |
| [AccountSettings](./AccountSettings.md) | Per-account configuration such as datetime format and timezone. |
| [AccountMembership](./AccountMembership.md) | Links a user to an account with a role and status. |
| [UserIdentity](./UserIdentity.md) | An external/local identity provider record for a user. |
| [RefreshToken](./RefreshToken.md) | A persisted, rotatable, revocable refresh-token session record. |
| [Asset](./Asset.md) | An uploaded image or PDF and its metadata, scoped to an account. |
| [Rendition](./Rendition.md) | A processed, resized variant of an asset. |
| [Publication](./Publication.md) | A record of publishing an asset to a channel. |
| [AssetComment](./AssetComment.md) | A user comment on an asset. |
| [AssetActivity](./AssetActivity.md) | An append-only activity log entry for an asset. |
| [Bundle](./Bundle.md) | An account-scoped, named collection that groups assets. |
| [BundleAsset](./BundleAsset.md) | The join record linking an asset to a bundle (with ordering). |
| [BundleShare](./BundleShare.md) | A revocable, optionally-expiring read-only share link for a bundle. |

## Roles

| Object | Description |
|---|---|
| [GlobalRole](./GlobalRole.md) | Platform-wide role: `super_user` or `user`. |
| [AccountRole](./AccountRole.md) | Account-scoped role: `account_owner`, `account_editor`, `account_viewer`. |

## Permissions & authorization

| Object | Description |
|---|---|
| [Permission](./Permission.md) | A single capability string checked during authorization. |
| [AuthAccountContext](./AuthAccountContext.md) | An account plus the membership and permissions a user holds in it. |
| [AuthTokens](./AuthTokens.md) | The login/signup response: access + refresh tokens and account context. |

## Value sets (enums)

| Object | Description |
|---|---|
| [AssetStatus](./AssetStatus.md) | Lifecycle state of an asset. |
| [AccountStatus](./AccountStatus.md) | Whether an account is active or disabled. |
| [MembershipStatus](./MembershipStatus.md) | Whether a membership is active or disabled. |
| [RenditionName](./RenditionName.md) | The named sizes a rendition can be. |
| [MetadataSource](./MetadataSource.md) | How an asset's metadata was produced. |
| [PublicationStatus](./PublicationStatus.md) | Outcome of a publish attempt. |
| [AssetActivityType](./AssetActivityType.md) | The kind of activity recorded. |
| [DateTimeFormat](./DateTimeFormat.md) | Named datetime presentation presets. |
| [SupportedMimeType](./SupportedMimeType.md) | Upload content types AssetX accepts. |

## Data transfer objects (API contracts)

| Object | Description |
|---|---|
| [UserDTO](./UserDTO.md) | Public representation of a user. |
| [AccountDTO](./AccountDTO.md) | Public representation of an account. |
| [AccountMembershipDTO](./AccountMembershipDTO.md) | Public representation of a membership. |
| [AccountSettingsDTO](./AccountSettingsDTO.md) | Public representation of account settings. |
| [AssetDTO](./AssetDTO.md) | Public representation of an asset (with renditions). |
| [BundleDTO](./BundleDTO.md) | Public representation of a bundle (with asset count). |
| [BundleDetailDTO](./BundleDetailDTO.md) | A bundle with its full, ordered asset list. |
| [BundleAssetDTO](./BundleAssetDTO.md) | A bundle entry: position + hydrated asset. |
| [BundleShareCreatedDTO](./BundleShareCreatedDTO.md) | One-time share-creation response (raw token + url). |
| [PublicBundleDTO](./PublicBundleDTO.md) | Read-only, unauthenticated view of a shared bundle. |
| [RenditionDTO](./RenditionDTO.md) | Public representation of a rendition. |
| [PublicationDTO](./PublicationDTO.md) | Public representation of a publication. |
| [AssetCommentDTO](./AssetCommentDTO.md) | Public representation of a comment. |
| [AssetActivityDTO](./AssetActivityDTO.md) | Public representation of an activity entry. |
| [AssetTimelineItemDTO](./AssetTimelineItemDTO.md) | A unified comment-or-activity timeline item. |
| [AdminUserDTO](./AdminUserDTO.md) | A user row for the platform admin user list. |
| [AdminUserDetailDTO](./AdminUserDetailDTO.md) | A user with their memberships for platform admin. |
| [SignupRequest](./SignupRequest.md) | The self-service sign-up request body. |
| [RenditionSpec](./RenditionSpec.md) | The recipe used to generate a rendition. |

## Infrastructure abstractions (packages)

| Object | Description |
|---|---|
| [StorageProvider](./StorageProvider.md) | Abstraction for storing/serving binary files. |
| [ImageProcessor](./ImageProcessor.md) | Abstraction for producing renditions from a source image. |
| [ChannelPublisher](./ChannelPublisher.md) | Abstraction for a publishing destination. |
| [JobQueue](./JobQueue.md) | Abstraction for background job enqueue/consume. |
| [TokenService](./TokenService.md) | Signs and verifies access/refresh JWTs. |
