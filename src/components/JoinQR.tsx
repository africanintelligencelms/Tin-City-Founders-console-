import React from 'react';
import { ProjectorStage } from './ProjectorStage';
import { PlateauProblem, AttendeeProfile, NavigationTab } from '../types';

interface JoinQRProps {
  attendeesCount?: number;
  latestProblem?: PlateauProblem | null;
  problems?: PlateauProblem[];
  attendees?: AttendeeProfile[];
  onOpenCheckIn?: () => void;
  onSaveProfile?: (profile: AttendeeProfile) => void;
  onNavigateTab?: (tab: NavigationTab) => void;
  onOpenAnalytics?: () => void;
}

export const JoinQR: React.FC<JoinQRProps> = (props) => {
  return <ProjectorStage {...props} />;
};

export { ProjectorStage };
