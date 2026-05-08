import React, { useMemo } from 'react';
import { Avatar, Select, Tag } from 'antd';
import type { DefaultOptionType, SelectProps } from 'antd/es/select';
import { UserOutlined } from '@ant-design/icons';
import type { ParticipantDirectoryMember } from '../types/model';

type ValueField = 'id' | 'fullName' | 'username';

type ParticipantDirectoryOption = DefaultOptionType & {
  value: string;
  label: string;
  searchText: string;
  member?: ParticipantDirectoryMember;
  isManual?: boolean;
};

export interface ParticipantSelectProps
  extends Omit<SelectProps<any, ParticipantDirectoryOption>, 'mode' | 'options' | 'tagRender'> {
  members: ParticipantDirectoryMember[];
  valueField?: ValueField;
  multiple?: boolean;
  allowCustomOptions?: boolean;
  extraOptions?: Array<{
    label: string;
    value: string;
  }>;
}

type ParticipantTagProps = Parameters<
  NonNullable<SelectProps<string[], ParticipantDirectoryOption>['tagRender']>
>[0];

function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getOptionValue(member: ParticipantDirectoryMember, valueField: ValueField) {
  if (valueField === 'fullName') return member.fullName;
  if (valueField === 'username') return member.username;
  return member.id;
}

export function ParticipantSelect({
  members,
  valueField = 'id',
  multiple = true,
  allowCustomOptions = false,
  extraOptions = [],
  ...props
}: ParticipantSelectProps) {
  const options = useMemo<ParticipantDirectoryOption[]>(() => {
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

  const renderAvatar = (option?: ParticipantDirectoryOption) => {
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

  const renderTag = ({ label, value, closable, onClose }: ParticipantTagProps) => {
    const option = optionsByValue.get(String(value));
    const isExternalOption = option?.member?.isExternal || option?.isManual || !option?.member;
    const sourceLabel = isExternalOption ? 'Externo' : 'Miembro';
    const sourceColor = isExternalOption ? 'gold' : 'blue';

    return (
      <Tag
        closable={closable}
        onClose={onClose}
        className="mr-1 inline-flex items-center gap-2 rounded-full px-2 py-1"
        style={{ marginInlineEnd: 6 }}
      >
        {renderAvatar(option)}
        <span>{label}</span>
        {option?.member || (allowCustomOptions && option?.isManual) || (allowCustomOptions && !option) ? (
          <Tag color={sourceColor} className="!m-0 rounded-full border-0 text-[10px] font-bold">
            {sourceLabel}
          </Tag>
        ) : null}
      </Tag>
    );
  };

  return (
    <Select<any, ParticipantDirectoryOption>
      mode={multiple ? (allowCustomOptions ? 'tags' : 'multiple') : undefined}
      options={options}
      optionFilterProp="label"
      maxTagCount="responsive"
      allowClear
      showSearch
      tokenSeparators={allowCustomOptions ? [','] : undefined}
      notFoundContent={
        allowCustomOptions
          ? 'Escribe un nombre y presiona Enter para agregar un participante externo.'
          : undefined
      }
      filterOption={(input, option) =>
        (option?.searchText || option?.label || '').toLowerCase().includes(input.toLowerCase())
      }
      optionRender={option => {
        const typedOption = option.data as ParticipantDirectoryOption;
        const isExternalOption =
          typedOption.member?.isExternal || typedOption.isManual || !typedOption.member;
        const sourceLabel = isExternalOption ? 'Externo' : 'Miembro';
        const sourceColor = isExternalOption ? 'gold' : 'blue';

        return (
          <div className="flex items-center gap-3 py-1">
            {renderAvatar(typedOption)}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate font-medium text-slate-800">{typedOption.label}</div>
                {typedOption.member || typedOption.isManual ? (
                  <Tag color={sourceColor} className="!m-0 rounded-full border-0 text-[10px] font-bold">
                    {sourceLabel}
                  </Tag>
                ) : null}
              </div>
              <div className="truncate text-xs text-slate-500">
                {typedOption.member?.isExternal
                  ? typedOption.member?.title || 'Participante externo'
                  : typedOption.member?.username
                    ? `@${typedOption.member.username}`
                    : typedOption.member?.title || ''}
              </div>
            </div>
          </div>
        );
      }}
      tagRender={multiple ? renderTag : undefined}
      {...props}
    />
  );
}

export default ParticipantSelect;
