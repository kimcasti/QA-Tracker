import React from 'react';
import { Avatar, Segmented } from 'antd';
import type { SegmentedProps } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import type { ParticipantDirectoryMember } from '../types/model';

export interface ParticipantSegmentedProps
  extends Omit<SegmentedProps<string>, 'options'> {
  members: ParticipantDirectoryMember[];
  valueField?: 'id' | 'fullName' | 'username';
}

function getOptionValue(
  member: ParticipantDirectoryMember,
  valueField: ParticipantSegmentedProps['valueField'] = 'id',
) {
  if (valueField === 'fullName') return member.fullName;
  if (valueField === 'username') return member.username;
  return member.id;
}

export function ParticipantSegmented({
  members,
  valueField = 'id',
  ...props
}: ParticipantSegmentedProps) {
  return (
    <Segmented
      options={members.map(member => ({
        label: (
          <span className="inline-flex items-center gap-2">
            <Avatar
              size={22}
              src={member.avatarUrl}
              icon={!member.avatarUrl ? <UserOutlined /> : undefined}
            />
            <span>{member.fullName}</span>
          </span>
        ),
        value: getOptionValue(member, valueField),
        title: member.fullName,
      }))}
      {...props}
    />
  );
}

export default ParticipantSegmented;
