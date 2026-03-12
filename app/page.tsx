'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { getReminderLabel, REMINDER_OPTIONS } from '@/lib/reminders';
import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

type Priority = 'high' | 'medium' | 'low';
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface Subtask {
  id: number;
  title: string;
  completed: number;
  position: number;
}

interface Todo {
  id: number;
  title: string;
  priority: Priority;
  due_date: string | null;
  reminder_minutes: number | null;
  completed: number;
  recurrence_enabled?: number | boolean | null;
  recurrence_pattern?: RecurrencePattern | null;
  tags?: Tag[];
  subtasks?: Subtask[];
  subtask_count_total?: number;
  subtask_count_completed?: number;
  subtask_progress_percent?: number;
}

interface Template {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  title_template: string;
  priority: Priority;
  recurrence_enabled: number;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
}

interface FilterPreset {
  name: string;
  searchQuery: string;
  priority: string;
  tagId: string;
  completion: 'all' | 'active' | 'completed';
  dueFrom: string;
  dueTo: string;
}

interface TodoApiResponse {
  success: boolean;
  data?: Todo[];
  error?: string;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: 16,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#0f172a',
};

const dateTimeInputStyle: React.CSSProperties = {
  ...inputStyle,
  colorScheme: 'light',
};

const chipButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 999,
  backgroundColor: '#ffffff',
  color: '#0f172a',
  padding: '8px 12px',
};

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 10,
  backgroundColor: '#0f766e',
  color: '#ffffff',
  padding: '10px 14px',
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 16px',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#0f172a',
  cursor: 'pointer',
  fontSize: 14,
};

function safeTagColor(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#0ea5e9';
}

function isRecurringEnabled(todo: Todo): boolean {
  return todo.recurrence_enabled === true || todo.recurrence_enabled === 1;
}

function parseReminderMinutes(value: string): number | null {
  if (!value) {
    return null;
  }
  return Number(value);
}

function priorityColor(priority: Priority): string {
  if (priority === 'high') return '#b91c1c';
  if (priority === 'medium') return '#facc15';
  return '#2563eb';
}

function priorityTextColor(priority: Priority): string {
  return priority === 'medium' ? '#111827' : '#ffffff';
}

function toSingaporeDateTimeLocalValue(input: string | null): string {
  if (!input) {
    return '';
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const mapped = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return `${mapped.year}-${mapped.month}-${mapped.day}T${mapped.hour}:${mapped.minute}`;
}

export default function HomePage() {
  const notificationState = useNotifications();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const dataMenuRef = useRef<HTMLDivElement | null>(null);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => getSingaporeNow().getTime());
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [showDataMenu, setShowDataMenu] = useState(false);

  const [message, setMessage] = useState('');
  const [createError, setCreateError] = useState('');
  const [editError, setEditError] = useState('');

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('daily');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCreateAdvanced, setShowCreateAdvanced] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingPriority, setEditingPriority] = useState<Priority>('medium');
  const [editingDueDate, setEditingDueDate] = useState('');
  const [editingReminderMinutes, setEditingReminderMinutes] = useState<number | null>(null);
  const [editingRepeatEnabled, setEditingRepeatEnabled] = useState(false);
  const [editingRecurrencePattern, setEditingRecurrencePattern] = useState<RecurrencePattern>('daily');
  const [editingTagIds, setEditingTagIds] = useState<number[]>([]);

  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<number, boolean>>({});
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<number, string>>({});
  const [subtaskErrors, setSubtaskErrors] = useState<Record<number, string>>({});
  const [subtaskSaving, setSubtaskSaving] = useState<Record<number, boolean>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterTagId, setFilterTagId] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterCompletion, setFilterCompletion] = useState<'all' | 'active' | 'completed'>('all');
  const [filterDueFrom, setFilterDueFrom] = useState('');
  const [filterDueTo, setFilterDueTo] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#0ea5e9');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');

  async function loadTodos() {
    setLoading(true);
    setCreateError('');

    try {
      const [todosResponse, tagsResponse, templatesResponse] = await Promise.all([
        fetch('/api/todos'),
        fetch('/api/tags'),
        fetch('/api/templates'),
      ]);

      if (!todosResponse.ok) {
        if (todosResponse.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Unable to load todos');
      }

      const todoBody = (await todosResponse.json()) as TodoApiResponse;
      setTodos(todoBody.data ?? []);

      if (tagsResponse.ok) {
        const tagBody = (await tagsResponse.json()) as { data?: Tag[] };
        setTags(tagBody.data ?? []);
      }

      if (templatesResponse.ok) {
        const templateBody = (await templatesResponse.json()) as { data?: Template[] };
        setTemplates(templateBody.data ?? []);
      }
    } catch {
      setCreateError('Failed to load todos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTodos();
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem('todo_filter_presets');
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as FilterPreset[];
      setPresets(parsed);
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    if (!showTagModal && !showTemplateModal) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowTagModal(false);
        setShowTemplateModal(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showTagModal, showTemplateModal]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTimeMs(getSingaporeNow().getTime());
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = (await response.json()) as { username?: string };
        setUsername(data.username ?? '');
      }
    })();
  }, []);

  useEffect(() => {
    if (!showDataMenu) return;
    function handleClickOutside(event: MouseEvent) {
      if (dataMenuRef.current && !dataMenuRef.current.contains(event.target as Node)) {
        setShowDataMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDataMenu]);

  function validateDueDate(rawDueDate: string): string | null {
    if (!rawDueDate) {
      return null;
    }

    const parsed = new Date(rawDueDate);
    const minAllowed = new Date(getSingaporeNow().getTime() + 60_000);
    if (parsed.getTime() < minAllowed.getTime()) {
      throw new Error('Due date must be at least 1 minute in the future');
    }

    return parsed.toISOString();
  }

  function persistPresets(next: FilterPreset[]) {
    setPresets(next);
    window.localStorage.setItem('todo_filter_presets', JSON.stringify(next));
  }

  function clearAllFilters() {
    setSearchQuery('');
    setFilterPriority('all');
    setFilterTagId('all');
    setFilterCompletion('all');
    setFilterDueFrom('');
    setFilterDueTo('');
  }

  function saveCurrentPreset() {
    const trimmed = presetName.trim();
    if (!trimmed) {
      return;
    }

    const preset: FilterPreset = {
      name: trimmed,
      searchQuery,
      priority: filterPriority,
      tagId: filterTagId,
      completion: filterCompletion,
      dueFrom: filterDueFrom,
      dueTo: filterDueTo,
    };

    const deduped = presets.filter((item) => item.name !== trimmed);
    persistPresets([...deduped, preset]);
    setPresetName('');
  }

  function applyPreset(preset: FilterPreset) {
    setSearchQuery(preset.searchQuery);
    setFilterPriority(preset.priority);
    setFilterTagId(preset.tagId);
    setFilterCompletion(preset.completion);
    setFilterDueFrom(preset.dueFrom);
    setFilterDueTo(preset.dueTo);
  }

  function removePreset(name: string) {
    persistPresets(presets.filter((preset) => preset.name !== name));
  }

  function getSubtaskStats(todo: Todo): { total: number; completedCount: number; percentage: number } {
    const subtasks = todo.subtasks ?? [];
    const total = todo.subtask_count_total ?? subtasks.length;
    const completedCount =
      todo.subtask_count_completed ?? subtasks.filter((subtask) => Boolean(subtask.completed)).length;
    const percentage = total > 0
      ? todo.subtask_progress_percent ?? Math.round((completedCount / total) * 100)
      : 0;

    return { total, completedCount, percentage };
  }

  function setSubtaskSavingFlag(todoId: number, savingFlag: boolean) {
    setSubtaskSaving((prev) => ({
      ...prev,
      [todoId]: savingFlag,
    }));
  }

  function toggleSubtasks(todoId: number) {
    setExpandedSubtasks((prev) => ({
      ...prev,
      [todoId]: !prev[todoId],
    }));
  }

  function updateSubtaskDraft(todoId: number, value: string) {
    setSubtaskDrafts((prev) => ({
      ...prev,
      [todoId]: value,
    }));

    if (subtaskErrors[todoId]) {
      setSubtaskErrors((prev) => ({
        ...prev,
        [todoId]: '',
      }));
    }
  }

  async function addSubtask(todoId: number) {
    const draftTitle = (subtaskDrafts[todoId] ?? '').trim();
    if (!draftTitle) {
      setSubtaskErrors((prev) => ({
        ...prev,
        [todoId]: 'Subtask title is required',
      }));
      return;
    }

    setSubtaskSavingFlag(todoId, true);
    try {
      const response = await fetch(`/api/todos/${todoId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: draftTitle }),
      });

      const data = (await response.json()) as { success?: boolean; data?: Todo; error?: string };
      if (!response.ok || !data.success || !data.data) {
        setSubtaskErrors((prev) => ({
          ...prev,
          [todoId]: data.error ?? 'Unable to add subtask',
        }));
        return;
      }

      setTodos((prev) => prev.map((todo) => (todo.id === todoId ? data.data! : todo)));
      setSubtaskDrafts((prev) => ({ ...prev, [todoId]: '' }));
      setSubtaskErrors((prev) => ({ ...prev, [todoId]: '' }));
      setExpandedSubtasks((prev) => ({ ...prev, [todoId]: true }));
    } catch {
      setSubtaskErrors((prev) => ({
        ...prev,
        [todoId]: 'Unable to add subtask',
      }));
    } finally {
      setSubtaskSavingFlag(todoId, false);
    }
  }

  async function toggleSubtaskComplete(todoId: number, subtask: Subtask) {
    setSubtaskSavingFlag(todoId, true);
    try {
      const response = await fetch(`/api/todos/${todoId}/subtasks/${subtask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !Boolean(subtask.completed) }),
      });

      const data = (await response.json()) as { success?: boolean; data?: Todo; error?: string };
      if (!response.ok || !data.success || !data.data) {
        setSubtaskErrors((prev) => ({
          ...prev,
          [todoId]: data.error ?? 'Unable to update subtask',
        }));
        return;
      }

      setTodos((prev) => prev.map((todo) => (todo.id === todoId ? data.data! : todo)));
      setSubtaskErrors((prev) => ({ ...prev, [todoId]: '' }));
    } catch {
      setSubtaskErrors((prev) => ({
        ...prev,
        [todoId]: 'Unable to update subtask',
      }));
    } finally {
      setSubtaskSavingFlag(todoId, false);
    }
  }

  async function deleteSubtask(todoId: number, subtaskId: number) {
    setSubtaskSavingFlag(todoId, true);
    try {
      const response = await fetch(`/api/todos/${todoId}/subtasks/${subtaskId}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as { success?: boolean; data?: Todo; error?: string };
      if (!response.ok || !data.success || !data.data) {
        setSubtaskErrors((prev) => ({
          ...prev,
          [todoId]: data.error ?? 'Unable to delete subtask',
        }));
        return;
      }

      setTodos((prev) => prev.map((todo) => (todo.id === todoId ? data.data! : todo)));
      setSubtaskErrors((prev) => ({ ...prev, [todoId]: '' }));
    } catch {
      setSubtaskErrors((prev) => ({
        ...prev,
        [todoId]: 'Unable to delete subtask',
      }));
    } finally {
      setSubtaskSavingFlag(todoId, false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError('');
    setMessage('');

    if (!title.trim()) {
      setCreateError('Title is required');
      return;
    }

    if (repeatEnabled && !dueDate) {
      setCreateError('Recurring todos require a due date');
      return;
    }

    setSaving(true);
    try {
      const dueDateIso = validateDueDate(dueDate);
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          due_date: dueDateIso,
          reminder_minutes: dueDateIso ? reminderMinutes : null,
          recurrence_enabled: repeatEnabled,
          recurrence_pattern: repeatEnabled ? recurrencePattern : null,
          tag_ids: selectedTagIds,
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setCreateError(body.error ?? 'Unable to create todo');
        return;
      }

      setTitle('');
      setPriority('medium');
      setDueDate('');
      setReminderMinutes(null);
      setRepeatEnabled(false);
      setRecurrencePattern('daily');
      setSelectedTagIds([]);
      setMessage('Todo created');
      await loadTodos();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to create todo');
    } finally {
      setSaving(false);
    }
  }

  function startEditing(todo: Todo) {
    setEditError('');
    setEditingId(todo.id);
    setEditingTitle(todo.title);
    setEditingPriority(todo.priority);
    setEditingDueDate(toSingaporeDateTimeLocalValue(todo.due_date));
    setEditingReminderMinutes(todo.reminder_minutes ?? null);
    setEditingRepeatEnabled(isRecurringEnabled(todo));
    setEditingRecurrencePattern(todo.recurrence_pattern ?? 'daily');
    setEditingTagIds((todo.tags ?? []).map((tag) => tag.id));
  }

  async function handleSaveEdit(todoId: number) {
    setEditError('');

    if (!editingTitle.trim()) {
      setEditError('Title is required');
      return;
    }

    if (editingRepeatEnabled && !editingDueDate) {
      setEditError('Recurring todos require a due date');
      return;
    }

    try {
      const dueDateIso = editingDueDate ? validateDueDate(editingDueDate) : null;
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingTitle.trim(),
          priority: editingPriority,
          due_date: dueDateIso,
          reminder_minutes: dueDateIso ? editingReminderMinutes : null,
          recurrence_enabled: editingRepeatEnabled,
          recurrence_pattern: editingRepeatEnabled ? editingRecurrencePattern : null,
          tag_ids: editingTagIds,
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setEditError(body.error ?? 'Unable to update todo');
        return;
      }

      setEditingId(null);
      await loadTodos();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Unable to update todo');
    }
  }

  async function toggleComplete(todo: Todo) {
    setCreateError('');
    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !Boolean(todo.completed) }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setCreateError(body.error ?? 'Unable to update todo');
        return;
      }

      await loadTodos();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to update todo');
    }
  }

  async function deleteTodo(todoId: number) {
    setCreateError('');
    try {
      const response = await fetch(`/api/todos/${todoId}`, { method: 'DELETE' });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setCreateError(body.error ?? 'Unable to delete todo');
        return;
      }

      setTodos((prev) => prev.filter((todo) => todo.id !== todoId));
      setExpandedSubtasks((prev) => {
        const { [todoId]: _, ...rest } = prev;
        return rest;
      });
      setSubtaskDrafts((prev) => {
        const { [todoId]: _, ...rest } = prev;
        return rest;
      });
      setSubtaskErrors((prev) => {
        const { [todoId]: _, ...rest } = prev;
        return rest;
      });
      setSubtaskSaving((prev) => {
        const { [todoId]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to delete todo');
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  async function exportTodos(format: 'json' | 'csv') {
    setMessage('');
    setCreateError('');

    try {
      const response = await fetch(`/api/todos/export?format=${format}`);
      if (!response.ok) {
        setCreateError('Unable to export todos');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `todos-export.${format}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(`Exported ${format.toUpperCase()}`);
    } catch {
      setCreateError('Unable to export todos');
    }
  }

  async function importTodos(file: File) {
    setMessage('');
    setCreateError('');

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as { data?: { todos?: Todo[] }; todos?: Todo[] };
      const todosForImport = payload.todos ?? payload.data?.todos ?? [];

      const response = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todos: todosForImport }),
      });

      const body = (await response.json()) as { error?: string; data?: { imported?: number } };
      if (!response.ok) {
        setCreateError(body.error ?? 'Unable to import todos');
        return;
      }

      setMessage(`Imported ${body.data?.imported ?? 0} todos`);
      await loadTodos();
    } catch {
      setCreateError('Invalid import file');
    }
  }

  async function saveTag() {
    if (!newTagName.trim()) {
      return;
    }

    try {
      const endpoint = editingTag ? `/api/tags/${editingTag.id}` : '/api/tags';
      const method = editingTag ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: safeTagColor(newTagColor),
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setCreateError(body.error ?? 'Unable to save tag');
        return;
      }

      setEditingTag(null);
      setNewTagName('');
      setNewTagColor('#0ea5e9');
      await loadTodos();
    } catch {
      setCreateError('Unable to save tag');
    }
  }

  async function deleteTag(tagId: number) {
    try {
      const response = await fetch(`/api/tags/${tagId}`, { method: 'DELETE' });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setCreateError(body.error ?? 'Unable to delete tag');
        return;
      }
      await loadTodos();
    } catch {
      setCreateError('Unable to delete tag');
    }
  }

  async function saveTemplateFromForm() {
    if (!templateName.trim()) {
      setCreateError('Template name is required');
      return;
    }

    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        category: templateCategory.trim() || null,
        title_template: title.trim() || templateName.trim(),
        priority,
        recurrence_enabled: repeatEnabled,
        recurrence_pattern: repeatEnabled ? recurrencePattern : null,
        reminder_minutes: dueDate ? reminderMinutes : null,
      }),
    });

    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setCreateError(body.error ?? 'Unable to save template');
      return;
    }

    setTemplateName('');
    setTemplateDescription('');
    setTemplateCategory('');
    await loadTodos();
  }

  async function useTemplate(templateId: number) {
    try {
      const response = await fetch(`/api/templates/${templateId}/use`, { method: 'POST' });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setCreateError(body.error ?? 'Unable to use template');
        return;
      }
      await loadTodos();
    } catch {
      setCreateError('Unable to use template');
    }
  }

  async function deleteTemplate(templateId: number) {
    try {
      const response = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setCreateError(body.error ?? 'Unable to delete template');
        return;
      }
      await loadTodos();
    } catch {
      setCreateError('Unable to delete template');
    }
  }

  const filteredTodos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return todos.filter((todo) => {
      if (query) {
        const inTitle = todo.title.toLowerCase().includes(query);
        const inSubtasks = (todo.subtasks ?? []).some((subtask) => subtask.title.toLowerCase().includes(query));
        if (!inTitle && !inSubtasks) {
          return false;
        }
      }

      if (filterPriority !== 'all' && todo.priority !== filterPriority) {
        return false;
      }

      if (filterTagId !== 'all') {
        const requiredTagId = Number(filterTagId);
        const hasTag = (todo.tags ?? []).some((tag) => tag.id === requiredTagId);
        if (!hasTag) {
          return false;
        }
      }

      const done = Boolean(todo.completed);
      if (filterCompletion === 'active' && done) {
        return false;
      }
      if (filterCompletion === 'completed' && !done) {
        return false;
      }

      if (todo.due_date && (filterDueFrom || filterDueTo)) {
        const dueDateValue = todo.due_date.slice(0, 10);
        if (filterDueFrom && dueDateValue < filterDueFrom) {
          return false;
        }
        if (filterDueTo && dueDateValue > filterDueTo) {
          return false;
        }
      }

      return true;
    });
  }, [todos, searchQuery, filterPriority, filterTagId, filterCompletion, filterDueFrom, filterDueTo]);

  const { overdue, active, completed } = useMemo(() => {
    return {
      overdue: filteredTodos.filter((todo) => !todo.completed && todo.due_date && new Date(todo.due_date).getTime() < currentTimeMs),
      active: filteredTodos.filter((todo) => !todo.completed && (!todo.due_date || new Date(todo.due_date).getTime() >= currentTimeMs)),
      completed: filteredTodos.filter((todo) => Boolean(todo.completed)),
    };
  }, [filteredTodos, currentTimeMs]);

  const totalTodos = filteredTodos.length;

  function renderTodoItem(todo: Todo) {
    const isEditing = editingId === todo.id;
    const stats = getSubtaskStats(todo);
    const hasSubtasks = stats.total > 0;
    const subtasks = (todo.subtasks ?? []).slice().sort((a, b) => a.position - b.position || a.id - b.id);
    const isExpanded = Boolean(expandedSubtasks[todo.id]);
    const isSubtaskBusy = Boolean(subtaskSaving[todo.id]);
    const subtaskDraft = subtaskDrafts[todo.id] ?? '';
    const subtaskError = subtaskErrors[todo.id] ?? '';

    return (
      <li
        key={todo.id}
        style={{
          display: 'grid',
          gap: 8,
          padding: 12,
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          marginBottom: 10,
        }}
      >
        {isEditing ? (
          <>
            <input
              value={editingTitle}
              onChange={(event) => {
                setEditError('');
                setEditingTitle(event.target.value);
              }}
              aria-label="Edit title"
              style={inputStyle}
            />
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <select
                value={editingPriority}
                onChange={(event) => {
                  setEditError('');
                  setEditingPriority(event.target.value as Priority);
                }}
                aria-label="Edit priority"
                style={inputStyle}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input
                type="datetime-local"
                value={editingDueDate}
                onChange={(event) => {
                  setEditError('');
                  setEditingDueDate(event.target.value);
                  if (!event.target.value) {
                    setEditingReminderMinutes(null);
                  }
                }}
                aria-label="Edit due date"
                style={dateTimeInputStyle}
              />
              <select
                value={editingReminderMinutes === null ? '' : String(editingReminderMinutes)}
                onChange={(event) => {
                  setEditError('');
                  setEditingReminderMinutes(parseReminderMinutes(event.target.value));
                }}
                aria-label="Edit reminder"
                disabled={!editingDueDate}
                style={inputStyle}
              >
                <option value="">No reminder</option>
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {getReminderLabel(option)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setEditError('');
                  setEditingRepeatEnabled((prev) => !prev);
                }}
                style={editingRepeatEnabled ? primaryButtonStyle : chipButtonStyle}
              >
                Repeat: {editingRepeatEnabled ? 'On' : 'Off'}
              </button>
              <select
                value={editingRecurrencePattern}
                onChange={(event) => {
                  setEditError('');
                  setEditingRecurrencePattern(event.target.value as RecurrencePattern);
                }}
                aria-label="Edit recurrence pattern"
                disabled={!editingRepeatEnabled}
                style={inputStyle}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tags.map((tag) => {
                const selected = editingTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setEditingTagIds((prev) => (selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]));
                    }}
                    style={{
                      border: selected ? `2px solid ${safeTagColor(tag.color)}` : '1px solid #cbd5e1',
                      borderRadius: 999,
                      padding: '4px 8px',
                      backgroundColor: selected ? `${safeTagColor(tag.color)}22` : '#f8fafc',
                      color: '#0f172a',
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void handleSaveEdit(todo.id)} style={primaryButtonStyle}>Save</button>
              <button type="button" onClick={() => setEditingId(null)} style={chipButtonStyle}>Cancel</button>
            </div>
            {editError ? <p style={{ margin: 0, color: '#b91c1c' }}>{editError}</p> : null}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ textDecoration: todo.completed ? 'line-through' : 'none', color: '#0f172a' }}>{todo.title}</strong>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: priorityTextColor(todo.priority),
                      backgroundColor: priorityColor(todo.priority),
                      padding: '2px 8px',
                      borderRadius: 999,
                      textTransform: 'uppercase',
                    }}
                  >
                    {todo.priority}
                  </span>
                  {isRecurringEnabled(todo) ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: 999 }}>
                      Repeat {todo.recurrence_pattern ?? 'daily'}
                    </span>
                  ) : null}
                  {todo.due_date ? (
                    <span style={{ color: '#475569', fontSize: 13 }}>Due: {formatSingaporeDate(todo.due_date)}</span>
                  ) : (
                    <span style={{ color: '#64748b', fontSize: 13 }}>No due date</span>
                  )}
                  {todo.reminder_minutes !== null ? (
                    <span style={{ color: '#0f766e', fontSize: 12, fontWeight: 700 }}>{getReminderLabel(todo.reminder_minutes)}</span>
                  ) : null}
                </div>
                {(todo.tags ?? []).length > 0 ? (
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(todo.tags ?? []).map((tag) => (
                      <span
                        key={tag.id}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#0f172a',
                          backgroundColor: `${safeTagColor(tag.color)}22`,
                          border: `1px solid ${safeTagColor(tag.color)}`,
                          borderRadius: 999,
                          padding: '2px 8px',
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => void toggleComplete(todo)} style={{ ...chipButtonStyle, backgroundColor: todo.completed ? '#e2e8f0' : '#0369a1', color: todo.completed ? '#1e293b' : '#ffffff', border: 'none' }}>
                  {todo.completed ? 'Uncomplete' : 'Complete'}
                </button>
                <button type="button" onClick={() => startEditing(todo)} style={chipButtonStyle}>Edit</button>
                <button type="button" onClick={() => void deleteTodo(todo.id)} style={{ ...chipButtonStyle, borderColor: '#fecaca', color: '#b91c1c' }}>
                  Delete
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, padding: 10, border: '1px solid #dbeafe', borderRadius: 10, backgroundColor: '#f8fafc' }}>
              {hasSubtasks ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: '#334155', fontSize: 13, fontWeight: 600 }}>{stats.completedCount}/{stats.total} subtasks</span>
                    <span style={{ color: '#0f766e', fontSize: 13, fontWeight: 700 }}>{stats.percentage}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Subtask progress for ${todo.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={stats.percentage}
                    style={{ height: 8, borderRadius: 999, backgroundColor: '#e2e8f0', overflow: 'hidden' }}
                  >
                    <div
                      style={{
                        width: `${stats.percentage}%`,
                        height: '100%',
                        backgroundColor: '#0f766e',
                        transition: 'width 150ms ease-out',
                      }}
                    />
                  </div>
                </>
              ) : null}

              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" onClick={() => toggleSubtasks(todo.id)} style={chipButtonStyle}>
                  {isExpanded ? 'Hide Subtasks' : 'Subtasks'}
                </button>
              </div>

              {isExpanded ? (
                <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      aria-label="Subtask title"
                      value={subtaskDraft}
                      onChange={(event) => updateSubtaskDraft(todo.id, event.target.value)}
                      placeholder="Add a subtask"
                      style={{ ...inputStyle, flex: '1 1 220px' }}
                    />
                    <button
                      type="button"
                      onClick={() => void addSubtask(todo.id)}
                      disabled={isSubtaskBusy}
                      style={primaryButtonStyle}
                    >
                      Add subtask
                    </button>
                  </div>

                  {subtaskError ? <p style={{ color: '#b91c1c', margin: 0 }}>{subtaskError}</p> : null}

                  {subtasks.length > 0 ? (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {subtasks.map((subtask) => (
                        <li
                          key={subtask.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '8px 10px',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <input
                              type="checkbox"
                              aria-label={`Toggle subtask ${subtask.title}`}
                              checked={Boolean(subtask.completed)}
                              onChange={() => void toggleSubtaskComplete(todo.id, subtask)}
                              disabled={isSubtaskBusy}
                            />
                            <span
                              style={{
                                textDecoration: subtask.completed ? 'line-through' : 'none',
                                color: subtask.completed ? '#64748b' : '#111827',
                              }}
                            >
                              {subtask.title}
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => void deleteSubtask(todo.id, subtask.id)}
                            disabled={isSubtaskBusy}
                            aria-label={`Delete subtask ${subtask.title}`}
                            title="Delete subtask"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#b91c1c',
                              cursor: 'pointer',
                              fontWeight: 700,
                            }}
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, color: '#64748b' }}>No subtasks yet.</p>
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}
      </li>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, #fef3c7, #f8fafc 45%)', padding: '32px 16px 48px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', ...cardStyle, borderRadius: 24, boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)' }}>
        <header style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>Welcome, {username || '…'}</p>
              <h1 style={{ margin: 0, color: '#0f172a', fontSize: 'clamp(1.6rem, 3.6vw, 2.1rem)' }}>Todo App</h1>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Data dropdown */}
              <div ref={dataMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  style={chipButtonStyle}
                  onClick={() => setShowDataMenu((prev) => !prev)}
                  aria-haspopup="true"
                  aria-expanded={showDataMenu}
                >
                  ⋮ Data
                </button>
                {showDataMenu && (
                  <div
                    role="menu"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      right: 0,
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      boxShadow: '0 4px 16px rgba(15,23,42,0.12)',
                      zIndex: 50,
                      minWidth: 160,
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      style={dropdownItemStyle}
                      onClick={() => { void exportTodos('json'); setShowDataMenu(false); }}
                    >
                      Export JSON
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      style={dropdownItemStyle}
                      onClick={() => { void exportTodos('csv'); setShowDataMenu(false); }}
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      style={dropdownItemStyle}
                      onClick={() => { importInputRef.current?.click(); setShowDataMenu(false); }}
                    >
                      Import JSON
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      style={dropdownItemStyle}
                      onClick={() => {
                        setShowTagModal(true);
                        setShowDataMenu(false);
                      }}
                    >
                      Manage Tags
                    </button>
                  </div>
                )}
              </div>

              {/* Calendar */}
              <a
                href="/calendar"
                style={{ ...chipButtonStyle, textDecoration: 'none', backgroundColor: '#7c3aed', color: '#ffffff', border: 'none' }}
              >
                Calendar
              </a>

              {/* Templates */}
              <button
                type="button"
                style={{ ...chipButtonStyle, backgroundColor: '#4f46e5', color: '#ffffff', border: 'none' }}
                onClick={() => setShowTemplateModal(true)}
              >
                Templates
              </button>

              {/* Notifications bell */}
              <button
                type="button"
                aria-label={!notificationState.resolved
                  ? 'Checking Notifications…'
                  : notificationState.permission === 'granted'
                  ? notificationState.enabled ? 'Notifications Enabled' : 'Notifications Paused'
                  : notificationState.permission === 'denied' ? 'Notifications Blocked'
                  : notificationState.supported ? 'Enable Notifications' : 'Notifications Unavailable'}
                title={!notificationState.resolved
                  ? 'Checking Notifications…'
                  : notificationState.permission === 'granted'
                  ? notificationState.enabled ? 'Notifications Enabled' : 'Notifications Paused'
                  : notificationState.permission === 'denied' ? 'Notifications Blocked'
                  : notificationState.supported ? 'Enable Notifications' : 'Notifications Unavailable'}
                style={{
                  ...chipButtonStyle,
                  backgroundColor: notificationState.enabled ? '#f97316' : undefined,
                  color: notificationState.enabled ? '#ffffff' : undefined,
                  border: notificationState.enabled ? 'none' : undefined,
                  fontSize: 18,
                  lineHeight: 1,
                  padding: '8px 12px',
                }}
                onClick={() => {
                  if (notificationState.permission === 'granted') {
                    notificationState.toggleEnabled();
                    return;
                  }
                  void notificationState.requestPermission();
                }}
                disabled={!notificationState.resolved || !notificationState.supported || notificationState.permission === 'denied'}
              >
                🔔
              </button>

              {/* Logout */}
              <button
                type="button"
                style={{ ...chipButtonStyle, backgroundColor: '#6b7280', color: '#ffffff', border: 'none' }}
                onClick={() => void handleLogout()}
              >
                Logout
              </button>
            </div>
          </div>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void importTodos(file);
              }
              event.currentTarget.value = '';
            }}
          />
        </header>

        <form onSubmit={handleCreate} style={{ ...cardStyle, marginBottom: 14 }}>
          <h2 style={{ marginTop: 0, marginBottom: 10, color: '#0f172a' }}>Create Todo</h2>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr auto' }}>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to be done?" aria-label="Todo title" style={inputStyle} />
            <button type="submit" disabled={saving} style={primaryButtonStyle}>{saving ? 'Adding...' : 'Add'}</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" style={chipButtonStyle} onClick={() => setShowCreateAdvanced((prev) => !prev)}>
              {showCreateAdvanced ? 'Hide Create Options' : 'Show Create Options'}
            </button>
            <button
              type="button"
              style={chipButtonStyle}
              onClick={() => {
                setTemplateName(title.trim());
                setShowTemplateModal(true);
              }}
              disabled={!title.trim()}
            >
              Save as Template
            </button>
          </div>

          {showCreateAdvanced ? (
            <div style={{ marginTop: 10, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} aria-label="Todo priority" style={inputStyle}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(event) => {
                  setDueDate(event.target.value);
                  if (!event.target.value) {
                    setReminderMinutes(null);
                  }
                }}
                aria-label="Todo due date"
                style={dateTimeInputStyle}
              />
              <select
                value={reminderMinutes === null ? '' : String(reminderMinutes)}
                onChange={(event) => setReminderMinutes(parseReminderMinutes(event.target.value))}
                aria-label="Todo reminder"
                disabled={!dueDate}
                style={inputStyle}
              >
                <option value="">No reminder</option>
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {getReminderLabel(option)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setRepeatEnabled((prev) => !prev)} style={repeatEnabled ? primaryButtonStyle : chipButtonStyle}>
                Repeat: {repeatEnabled ? 'On' : 'Off'}
              </button>
              <select
                value={recurrencePattern}
                onChange={(event) => setRecurrencePattern(event.target.value as RecurrencePattern)}
                aria-label="Todo recurrence pattern"
                disabled={!repeatEnabled}
                style={inputStyle}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          ) : null}

          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedTagIds((prev) => (selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]))}
                  style={{
                    border: selected ? `2px solid ${safeTagColor(tag.color)}` : '1px solid #cbd5e1',
                    borderRadius: 999,
                    padding: '4px 8px',
                    backgroundColor: selected ? `${safeTagColor(tag.color)}22` : '#f8fafc',
                    color: '#0f172a',
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>

          {createError ? <p style={{ color: '#b91c1c', marginBottom: 0 }}>{createError}</p> : null}
          {message ? <p style={{ color: '#0369a1', marginBottom: 0 }}>{message}</p> : null}
        </form>

        <section style={{ ...cardStyle, marginBottom: 14 }}>
          <h2 style={{ marginTop: 0, marginBottom: 10, color: '#0f172a' }}>Find & Filter</h2>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <input placeholder="Search todos and subtasks" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Todo search" style={inputStyle} />
            <select value={filterPriority} onChange={(event) => setFilterPriority(event.target.value)} aria-label="Priority filter" style={inputStyle}>
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={filterTagId} onChange={(event) => setFilterTagId(event.target.value)} aria-label="Tag filter" style={inputStyle}>
              <option value="all">All tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={String(tag.id)}>{tag.name}</option>
              ))}
            </select>
            <button type="button" style={chipButtonStyle} onClick={() => setShowAdvancedFilters((prev) => !prev)}>
              {showAdvancedFilters ? 'Hide Advanced' : 'Advanced'}
            </button>
            <button type="button" style={chipButtonStyle} onClick={clearAllFilters}>Clear All</button>
          </div>

          {showAdvancedFilters ? (
            <div style={{ marginTop: 10, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              <select value={filterCompletion} onChange={(event) => setFilterCompletion(event.target.value as 'all' | 'active' | 'completed')} aria-label="Completion filter" style={inputStyle}>
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="completed">Completed only</option>
              </select>
              <input type="date" value={filterDueFrom} onChange={(event) => setFilterDueFrom(event.target.value)} aria-label="Due date from" style={inputStyle} />
              <input type="date" value={filterDueTo} onChange={(event) => setFilterDueTo(event.target.value)} aria-label="Due date to" style={inputStyle} />
            </div>
          ) : null}

          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" aria-label="Preset name" style={inputStyle} />
            <button type="button" onClick={saveCurrentPreset} style={chipButtonStyle}>Save Preset</button>
            {presets.map((preset) => (
              <div key={preset.name} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button type="button" onClick={() => applyPreset(preset)} style={chipButtonStyle}>{preset.name}</button>
                <button type="button" onClick={() => removePreset(preset.name)} aria-label={`Delete preset ${preset.name}`} style={{ border: 'none', background: 'transparent', color: '#b91c1c' }}>
                  x
                </button>
              </div>
            ))}
          </div>
        </section>

        {loading ? <p style={{ color: '#64748b' }}>Loading todos...</p> : null}

        {overdue.length > 0 ? (
          <section style={{ ...cardStyle, marginBottom: 14, borderColor: '#fecaca', backgroundColor: '#fff1f2' }}>
            <h2 style={{ marginTop: 0, color: '#9f1239' }}>Overdue ({overdue.length})</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{overdue.map(renderTodoItem)}</ul>
          </section>
        ) : null}

        <section style={{ ...cardStyle, marginBottom: 14 }}>
          <h2 style={{ marginTop: 0, color: '#0f172a' }}>Active ({active.length})</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{active.map(renderTodoItem)}</ul>
          {active.length === 0 ? <p style={{ color: '#64748b', marginBottom: 0 }}>No matching active todos.</p> : null}
        </section>

        <section style={{ ...cardStyle, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}>
          <h2 style={{ marginTop: 0, color: '#166534' }}>Completed ({completed.length})</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{completed.map(renderTodoItem)}</ul>
          {completed.length === 0 ? <p style={{ color: '#64748b', marginBottom: 0 }}>No completed todos.</p> : null}
        </section>

        <section
          style={{
            ...cardStyle,
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            textAlign: 'center',
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 40, lineHeight: 1, fontWeight: 700, color: '#dc2626' }}>{overdue.length}</p>
            <p style={{ margin: '6px 0 0', color: '#475569' }}>Overdue</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 40, lineHeight: 1, fontWeight: 700, color: '#2563eb' }}>{active.length}</p>
            <p style={{ margin: '6px 0 0', color: '#475569' }}>Pending</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 40, lineHeight: 1, fontWeight: 700, color: '#16a34a' }}>{completed.length}</p>
            <p style={{ margin: '6px 0 0', color: '#475569' }}>Completed</p>
          </div>
        </section>

        {showTagModal ? (
          <>
            <div onClick={() => setShowTagModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 19 }} />
            <div role="dialog" aria-modal="true" aria-labelledby="tag-modal-title" tabIndex={-1} style={{ ...cardStyle, position: 'fixed', inset: 20, margin: 'auto', maxWidth: 700, maxHeight: '80vh', overflowY: 'auto', zIndex: 20 }}>
              <h2 id="tag-modal-title" style={{ marginTop: 0, color: '#0f172a' }}>Manage Tags</h2>
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '2fr 1fr 1fr auto', marginBottom: 10 }}>
                <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="Tag name" aria-label="Tag name" style={inputStyle} />
                <input type="color" value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} aria-label="Tag color" style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid #cbd5e1' }} />
                <input
                  value={newTagColor}
                  onChange={(event) => {
                    if (/^#[0-9a-f]{0,6}$/i.test(event.target.value)) {
                      setNewTagColor(event.target.value);
                    }
                  }}
                  aria-label="Tag color hex"
                  style={inputStyle}
                />
                <button type="button" onClick={() => void saveTag()} style={primaryButtonStyle}>{editingTag ? 'Update' : 'Add'}</button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {tags.map((tag) => (
                  <div key={tag.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: safeTagColor(tag.color), border: '1px solid #cbd5e1' }} />
                      <span style={{ color: '#0f172a' }}>{tag.name}</span>
                      <span style={{ color: '#64748b' }}>{safeTagColor(tag.color)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTag(tag);
                          setNewTagName(tag.name);
                          setNewTagColor(tag.color);
                        }}
                        style={chipButtonStyle}
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => void deleteTag(tag.id)} style={{ ...chipButtonStyle, color: '#b91c1c', borderColor: '#fecaca' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={() => setShowTagModal(false)} style={chipButtonStyle}>Close</button>
              </div>
            </div>
          </>
        ) : null}

        {showTemplateModal ? (
          <>
            <div onClick={() => setShowTemplateModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 19 }} />
            <div role="dialog" aria-modal="true" aria-labelledby="template-modal-title" tabIndex={-1} style={{ ...cardStyle, position: 'fixed', inset: 20, margin: 'auto', maxWidth: 700, maxHeight: '80vh', overflowY: 'auto', zIndex: 20 }}>
              <h2 id="template-modal-title" style={{ marginTop: 0, color: '#0f172a' }}>Templates</h2>
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr auto', marginBottom: 10 }}>
                <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" aria-label="Template name" style={inputStyle} />
                <input value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} placeholder="Description (optional)" aria-label="Template description" style={inputStyle} />
                <input value={templateCategory} onChange={(event) => setTemplateCategory(event.target.value)} placeholder="Category (optional)" aria-label="Template category" style={inputStyle} />
                <button type="button" onClick={() => void saveTemplateFromForm()} style={primaryButtonStyle}>Save</button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {templates.map((template) => (
                  <div key={template.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                    <strong style={{ color: '#0f172a' }}>{template.name}</strong>
                    <p style={{ marginTop: 6, marginBottom: 6, color: '#334155' }}>{template.description ?? 'No description'}</p>
                    <p style={{ marginTop: 0, marginBottom: 8, color: '#64748b', fontSize: 13 }}>
                      Category: {template.category ?? 'none'} | Priority: {template.priority} | Repeat: {template.recurrence_enabled ? template.recurrence_pattern ?? 'daily' : 'off'} | Reminder: {getReminderLabel(template.reminder_minutes) ?? 'none'}
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => void useTemplate(template.id)} style={{ ...chipButtonStyle, color: '#0369a1', borderColor: '#bae6fd' }}>Use</button>
                      <button type="button" onClick={() => void deleteTemplate(template.id)} style={{ ...chipButtonStyle, color: '#b91c1c', borderColor: '#fecaca' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={() => setShowTemplateModal(false)} style={chipButtonStyle}>Close</button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
