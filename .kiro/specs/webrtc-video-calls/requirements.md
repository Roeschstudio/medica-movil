# Requirements Document

## Introduction

This feature implements a complete free video calling system using native WebRTC technology with Supabase for signaling, enabling peer-to-peer video calls between doctors and patients without requiring external paid services like Twilio or Agora. The system will integrate seamlessly with the existing chat functionality and provide professional-grade video communication capabilities.

## Requirements

### Requirement 1

**User Story:** As a doctor, I want to initiate video calls with my patients during chat sessions, so that I can provide more personalized and effective medical consultations.

#### Acceptance Criteria

1. WHEN a doctor clicks the video call button in a chat room THEN the system SHALL create a video call record and send an invitation to the patient
2. WHEN initiating a call THEN the system SHALL request camera and microphone permissions from the doctor
3. WHEN the call is being established THEN the system SHALL display a "connecting" status to the doctor
4. IF the patient is offline or unavailable THEN the system SHALL display an appropriate error message
5. WHEN the call connects successfully THEN the system SHALL display both local and remote video streams

### Requirement 2

**User Story:** As a patient, I want to receive and respond to incoming video calls from my doctor, so that I can participate in video consultations when needed.

#### Acceptance Criteria

1. WHEN a doctor initiates a video call THEN the patient SHALL receive a real-time notification with call details
2. WHEN receiving an incoming call THEN the system SHALL display accept/decline options to the patient
3. WHEN the patient accepts a call THEN the system SHALL request camera and microphone permissions
4. WHEN the patient declines a call THEN the system SHALL notify the doctor and update the call status
5. WHEN the patient accepts a call THEN the system SHALL establish the WebRTC connection and display video streams

### Requirement 3

**User Story:** As a user (doctor or patient), I want to control my camera and microphone during video calls, so that I can manage my privacy and audio/video quality.

#### Acceptance Criteria

1. WHEN in an active video call THEN the system SHALL provide toggle buttons for camera and microphone
2. WHEN the camera is disabled THEN the system SHALL show a placeholder image instead of the video stream
3. WHEN the microphone is muted THEN the system SHALL display a mute indicator to both participants
4. WHEN toggling camera or microphone THEN the changes SHALL be reflected immediately for both participants
5. WHEN a participant disables their camera THEN the other participant SHALL see the camera-off indicator

### Requirement 4

**User Story:** As a user, I want to end video calls when the consultation is complete, so that I can properly conclude the session and free up system resources.

#### Acceptance Criteria

1. WHEN either participant clicks the end call button THEN the system SHALL terminate the call for both users
2. WHEN a call ends THEN the system SHALL calculate and store the call duration
3. WHEN a call ends THEN the system SHALL clean up all WebRTC connections and media streams
4. WHEN a call ends THEN the system SHALL update the call status to "ended" in the database
5. WHEN a call ends THEN both participants SHALL be returned to the chat interface

### Requirement 5

**User Story:** As a user, I want the video call interface to be responsive and professional, so that I can have a smooth experience across different devices and screen sizes.

#### Acceptance Criteria

1. WHEN using the video call interface THEN it SHALL be responsive across desktop, tablet, and mobile devices
2. WHEN in a video call THEN the system SHALL provide a fullscreen mode option
3. WHEN controls are not being used THEN they SHALL auto-hide after 3 seconds to maximize video space
4. WHEN hovering over the video area THEN the controls SHALL reappear immediately
5. WHEN in fullscreen mode THEN all essential controls SHALL remain accessible

### Requirement 6

**User Story:** As a system administrator, I want video call data to be properly stored and managed, so that I can track usage and ensure system reliability.

#### Acceptance Criteria

1. WHEN a video call is initiated THEN the system SHALL create a record in the video_calls table
2. WHEN WebRTC signaling occurs THEN the system SHALL store signals in the webrtc_signals table
3. WHEN a call status changes THEN the system SHALL update the database with timestamps
4. WHEN storing call data THEN the system SHALL enforce proper row-level security policies
5. WHEN calls are completed THEN the system SHALL calculate and store accurate duration metrics

### Requirement 7

**User Story:** As a developer, I want the video calling system to use only free technologies, so that we can provide this service without additional costs to users or the platform.

#### Acceptance Criteria

1. WHEN implementing video calls THEN the system SHALL use only native WebRTC APIs
2. WHEN handling signaling THEN the system SHALL use Supabase Realtime exclusively
3. WHEN establishing peer connections THEN the system SHALL use free STUN servers (Google's public STUN servers)
4. IF WebRTC is not supported THEN the system SHALL display an appropriate fallback message
5. WHEN deploying THEN the system SHALL require no additional paid services or API keys

### Requirement 8

**User Story:** As a user, I want video calls to integrate seamlessly with the existing chat system, so that I can easily transition between text and video communication.

#### Acceptance Criteria

1. WHEN in a chat room THEN the system SHALL display a video call button in the chat header
2. WHEN a video call is active THEN users SHALL be able to return to the chat interface
3. WHEN a call ends THEN users SHALL automatically return to the chat room
4. WHEN starting a call THEN the system SHALL use the existing chat room for context
5. WHEN calls are made THEN they SHALL be associated with the current appointment/chat session

### Requirement 9

**User Story:** As a user, I want proper error handling and recovery for video calls, so that technical issues don't completely disrupt my medical consultation.

#### Acceptance Criteria

1. WHEN WebRTC connection fails THEN the system SHALL display a clear error message and retry options
2. WHEN camera/microphone access is denied THEN the system SHALL provide instructions for enabling permissions
3. WHEN network connectivity is poor THEN the system SHALL display connection quality indicators
4. WHEN a call drops unexpectedly THEN the system SHALL attempt automatic reconnection
5. WHEN errors occur THEN the system SHALL log appropriate details for debugging while maintaining user privacy

### Requirement 10

**User Story:** As a user, I want video calls to work securely over HTTPS, so that my medical consultations remain private and secure.

#### Acceptance Criteria

1. WHEN accessing video call features THEN the system SHALL require HTTPS connection
2. WHEN in development THEN the system SHALL work with local HTTPS setup or tunneling tools
3. WHEN in production THEN the system SHALL automatically use HTTPS through Vercel
4. WHEN WebRTC connections are established THEN they SHALL use secure peer-to-peer protocols
5. WHEN signaling data is transmitted THEN it SHALL be encrypted through Supabase's secure channels
