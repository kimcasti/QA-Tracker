import React, { useMemo } from 'react';
import { Avatar, Select, Tag } from 'antd';
import type { DefaultOptionType, SelectProps } from 'antd/es/select';
import { UserOutlined } from '@ant-design/icons';
import type { SlackMember } from '../types/model';

type ValueField = 'id' | 'fullName' | 'username';

type SlackMemberOption = DefaultOptionType & {
  value: string;
  label: string;
  searchText: string;
  member?: SlackMember;
  isManual?: boolean;
};

export interface SlackMemberSelectProps
  extends Omit<SelectProps<any, SlackMemberOption>, 'mode' | 'options' | 'tagRender'> {
  members: SlackMember[];
  valueField?: ValueField;
  multiple?: boolean;
  extraOptions?: Array<{
    label: string;
    value: string;
  }>;
}

type SlackMemberTagProps = Parameters<
  NonNullable<SelectProps<string[], SlackMemberOption>['tagRender']>
>[0];

function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getOptionValue(member: SlackMember, valueField: ValueField) {
  if (valueField === 'fullName') return member.fullName;
  if (valueField === 'username') return member.username;
  return member.id;
}

export function SlackMemberSelect({
  members,
  valueField = 'id',
  multiple = true,
  extraOptions = [],
  ...props
}: SlackMemberSelectProps) {
  const options = useMemo<SlackMemberOption[]>(() => {
    const memberOptions = members.map(member => ({
      value: getOptionValue(member, valueField),
      label: member.fullName,
      searchText: [member.fullName, member.displayName, member.realName, member.username]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      member,
    }));

    const seenValues = new Set(memberOptions.map(option => option.value));
    const manualOptions = extraOptions
      .filter(option => option.value && !seenValues.has(option.value))
      .map(option => ({
        value: option.value,
        label: option.label,
        searchText: `${option.label} ${option.value}`.toLowerCase(),
        isManual: true,
      }));

    return [...memberOptions, ...manualOptions];
  }, [extraOptions, members, valueField]);

  const optionsByValue = useMemo(
    () => new Map(options.map(option => [option.value, option])),
    [options],
  );

  const renderAvatar = (option?: SlackMemberOption) => {
    const member = option?.member;
    const label = option?.label || option?.value || '';

    return (
      <Avatar
        size={28}
        src={member?.avatarUrl}
        icon={!member?.avatarUrl ? <UserOutlined /> : undefined}
        style={!member?.avatarUrl ? { backgroundColor: '#e2e8f0', color: '#475569' } : undefined}
      >
        {!member?.avatarUrl ? getInitials(label) : null}
      </Avatar>
    );
  };

  const renderTag = ({ label, value, closable, onClose }: SlackMemberTagProps) => {
    const option = optionsByValue.get(String(value));

    return (
      <Tag
        closable={closable}
        onClose={onClose}
        className="mr-1 inline-flex items-center gap-2 rounded-full px-2 py-1"
        style={{ marginInlineEnd: 6 }}
      >
        {renderAvatar(option)}
        <span>{label}</span>
      </Tag>
    );
  };

  return (
    <Select<any, SlackMemberOption>
      mode={multiple ? 'tags' : undefined}
      options={options}
      optionFilterProp="label"
      maxTagCount="responsive"
      allowClear
      showSearch
      tokenSeparators={[',']}
      filterOption={(input, option) =>
        (option?.searchText || option?.label || '').toLowerCase().includes(input.toLowerCase())
      }
      optionRender={option => {
        const typedOption = option.data as SlackMemberOption;

        return (
          <div className="flex items-center gap-3 py-1">
            {renderAvatar(typedOption)}
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-800">{typedOption.label}</div>
              {typedOption.member?.username && (
                <div className="truncate text-xs text-slate-500">@{typedOption.member.username}</div>
              )}
            </div>
          </div>
        );
      }}
      tagRender={multiple ? renderTag : undefined}
      {...props}
    />
  );
}

export default SlackMemberSelect;
