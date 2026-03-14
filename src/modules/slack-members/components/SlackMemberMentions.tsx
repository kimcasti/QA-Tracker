import React from 'react';
import { Mentions } from 'antd';
import type { MentionsProps } from 'antd';
import type { SlackMember } from '../types/model';

export interface SlackMemberMentionsProps
  extends Omit<MentionsProps, 'options'> {
  members: SlackMember[];
  valueField?: 'id' | 'fullName' | 'username';
}

function getOptionValue(
  member: SlackMember,
  valueField: SlackMemberMentionsProps['valueField'] = 'username',
) {
  if (valueField === 'fullName') return member.fullName;
  if (valueField === 'id') return member.id;
  return member.username;
}

export function SlackMemberMentions({
  members,
  valueField = 'username',
  ...props
}: SlackMemberMentionsProps) {
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

export default SlackMemberMentions;
