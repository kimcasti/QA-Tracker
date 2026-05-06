import React from 'react';
import { Mentions } from 'antd';
import type { MentionsProps } from 'antd';
import type { ParticipantDirectoryMember } from '../types/model';

export interface ParticipantMentionsProps
  extends Omit<MentionsProps, 'options'> {
  members: ParticipantDirectoryMember[];
  valueField?: 'id' | 'fullName' | 'username';
}

function getOptionValue(
  member: ParticipantDirectoryMember,
  valueField: ParticipantMentionsProps['valueField'] = 'username',
) {
  if (valueField === 'fullName') return member.fullName;
  if (valueField === 'id') return member.id;
  return member.username;
}

export function ParticipantMentions({
  members,
  valueField = 'username',
  ...props
}: ParticipantMentionsProps) {
  return (
    <Mentions
      options={members.map(member => ({
        value: getOptionValue(member, valueField),
        label: `${member.fullName}${member.username ? ` (@${member.username})` : ''}`,
      }))}
      {...props}
    />
  );
}

export default ParticipantMentions;
