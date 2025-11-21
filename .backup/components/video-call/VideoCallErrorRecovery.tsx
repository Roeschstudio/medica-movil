"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  VideoCallErrorHandler,
  VideoCallErrorType,
  WebRTCCompatibility,
  type VideoCallError,
} from "@/lib/video-call-errors";
import {
  AlertCircle,
  CheckCircle,
  Info,
  RefreshCw,
  Settings,
  XCircle,
} from "lucide-react";

interface VideoCallErrorRecoveryProps {
  error: VideoCallError | Error;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function VideoCallErrorRecovery({
  error,
  onRetry,
  onDismiss,
  className,
}: VideoCallErrorRecoveryProps) {
  const isVideoCallError = "type" in error;
  const errorType = isVideoCallError
    ? error.type
    : VideoCallErrorHandler.detectErrorType(error);
  const userMessage = VideoCallErrorHandler.getUserMessage(error);
  const recoveryActions = VideoCallErrorHandler.getRecoveryActions(error);
  const isRecoverable = VideoCallErrorHandler.isRecoverable(error);

  const getErrorIcon = () => {
    if (isRecoverable) {
      return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  const getErrorColor = () => {
    if (isRecoverable) {
      return "border-yellow-200 bg-yellow-50";
    }
    return "border-red-200 bg-red-50";
  };

  const handleOpenBrowserSettings = () => {
    // This will vary by browser, but we can provide general guidance
    window.open("chrome://settings/content/camera", "_blank");
  };

  return (
    <Card className={cn(getErrorColor(), className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          {getErrorIcon()}
          <div className="flex-1">
            <CardTitle className="text-lg text-gray-900">
              Video Call Error
            </CardTitle>
            <Badge
              variant={isRecoverable ? "secondary" : "destructive"}
              className="mt-1"
            >
              {isRecoverable ? "Recoverable" : "Not Recoverable"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error message */}
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription className="text-gray-700">
            {userMessage}
          </AlertDescription>
        </Alert>

        {/* WebRTC compatibility report for unsupported browsers */}
        {errorType === VideoCallErrorType.WEBRTC_NOT_SUPPORTED && (
          <WebRTCCompatibilityReport />
        )}

        {/* Recovery actions */}
        {recoveryActions.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">How to fix this:</h4>
            <ul className="space-y-2">
              {recoveryActions.map((action, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          {isRecoverable && onRetry && (
            <Button onClick={onRetry} className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}

          {errorType === VideoCallErrorType.MEDIA_ACCESS_DENIED && (
            <Button
              onClick={handleOpenBrowserSettings}
              variant="outline"
              className="flex-1"
            >
              <Settings className="w-4 h-4 mr-2" />
              Browser Settings
            </Button>
          )}

          {onDismiss && (
            <Button
              onClick={onDismiss}
              variant="outline"
              className={isRecoverable ? "" : "flex-1"}
            >
              Dismiss
            </Button>
          )}
        </div>

        {/* Technical details (collapsible) */}
        {process.env.NODE_ENV === "development" && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              Technical Details
            </summary>
            <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-700">
              <div>
                <strong>Error Type:</strong> {errorType}
              </div>
              <div>
                <strong>Message:</strong> {error.message}
              </div>
              {isVideoCallError && error.technicalMessage && (
                <div>
                  <strong>Technical:</strong> {error.technicalMessage}
                </div>
              )}
              {error.stack && (
                <div className="mt-2">
                  <strong>Stack:</strong>
                  <pre className="whitespace-pre-wrap text-xs">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function WebRTCCompatibilityReport() {
  const report = WebRTCCompatibility.getCompatibilityReport();

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900">Browser Compatibility</h4>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {report.features.rtcPeerConnection ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>WebRTC Support</span>
          </div>

          <div className="flex items-center gap-2">
            {report.features.getUserMedia ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>Camera/Mic Access</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {report.features.mediaDevices ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>Media Devices API</span>
          </div>

          <div className="text-gray-600">
            <strong>Browser:</strong> {report.browser}
          </div>
        </div>
      </div>

      {report.recommendations.length > 0 && (
        <div>
          <h5 className="font-medium text-gray-800 mb-1">Recommendations:</h5>
          <ul className="space-y-1 text-sm text-gray-700">
            {report.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2">
                <Info className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
