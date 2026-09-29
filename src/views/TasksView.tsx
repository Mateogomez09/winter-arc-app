import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Circle, CheckCircle2, MoreVertical, X, Plus } from 'lucide-react';
import { useTranslation } from "react-i18next";
import { User, Task } from '../types';
import { getTasksToday, toggleTask, createTask, editTask, deleteTask, getLocalDateString } from '../services/db';

interface TasksViewProps {
  user: User;
}

export const TasksView: React.FC<TasksViewProps> = ({ user }) => {
  const { t } = useTranslation();
  const [localRefresh, setLocalRefresh] = useState(0);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [modalTaskMode, setModalTaskMode] = useState<'create' | 'edit'>('create');
  const [modalTaskTitle, setModalTaskTitle] = useState('');
  const [modalTaskPriority, setModalTaskPriority] = useState<1 | 2 | 3>(2);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);

  const tasks = getTasksToday();
  const todayStr = getLocalDateString();

  const pendingTasks = tasks
    .filter(t => !t.completed)
    .sort((a, b) => (a.priority || 2) - (b.priority || 2));
    
  const completedTasks = tasks
    .filter(t => t.completed)
    .sort((a, b) => (a.priority || 2) - (b.priority || 2));

  const handleTaskCheck = (taskId: string) => {
    toggleTask(taskId);
    setLocalRefresh(prev => prev + 1);
  };

  const handleOpenCreateTask = () => {
    setModalTaskMode('create');
    setModalTaskTitle('');
    setModalTaskPriority(2);
    setShowTaskModal(true);
  };

  const handleEditTaskClick = (task: Task) => {
    setModalTaskMode('edit');
    setEditingTaskId(task.id);
    setModalTaskTitle(task.title);
    setModalTaskPriority(task.priority || 2);
    setOpenTaskMenuId(null);
    setShowTaskModal(true);
  };

  const handleSaveModalTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTaskTitle.trim()) return;

    if (modalTaskMode === 'create') {
      createTask(modalTaskTitle.trim(), modalTaskPriority);
    } else if (modalTaskMode === 'edit' && editingTaskId) {
      editTask(editingTaskId, modalTaskTitle.trim(), modalTaskPriority);
    }
    
    setShowTaskModal(false);
    setEditingTaskId(null);
    setLocalRefresh(prev => prev + 1);
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(taskId);
    setOpenTaskMenuId(null);
    setLocalRefresh(prev => prev + 1);
  };

  return (
    <div className="min-w-full w-full flex-shrink-0 snap-center overflow-y-auto px-5 pt-4 pb-24 h-full relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-brand-text tracking-tight mt-0.5">
            {t('Tus Tareas')}
          </h1>
          <p className="text-xs text-brand-text-muted mt-1">{t('Organiza tu día de Winter Arc')}</p>
        </div>
      </div>

      <div className="space-y-4 text-left">
        <button 
          onClick={handleOpenCreateTask}
          className="w-full py-3 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 rounded-xl flex items-center justify-center space-x-2 text-brand-primary transition-colors text-xs font-bold mb-3"
        >
          <div className="w-5 h-5 rounded bg-brand-primary/20 flex items-center justify-center border border-brand-primary/30">
            <span className="text-brand-primary">+</span>
          </div>
          <span>{t('Añadir Tarea')}</span>
        </button>

        {pendingTasks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text-muted px-1">{t('Pendientes')}</h3>
            {pendingTasks.map(task => {
              const isDelayed = task.original_date && task.original_date < todayStr;
              return (
                <div key={task.id} className="relative flex items-center justify-between p-3 bg-brand-card hover:bg-brand-card-sec border border-brand-border rounded-xl transition-colors group shadow-sm">
                  <div onClick={() => handleTaskCheck(task.id)} className="flex items-center space-x-3 cursor-pointer flex-1">
                    <Circle className={`shrink-0 ${task.priority === 1 ? 'text-brand-red' : task.priority === 3 ? 'text-brand-text-muted opacity-50' : 'text-brand-primary'}`} size={20} />
                    <div className="flex flex-col items-start text-left">
                      <span className="text-sm font-medium text-brand-text leading-tight">{task.title}</span>
                      {isDelayed && (
                        <span className="text-[9px] font-bold text-brand-red uppercase tracking-wider bg-brand-red/10 px-1.5 py-0.5 rounded mt-0.5">{t('Retrasada')}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setOpenTaskMenuId(openTaskMenuId === task.id ? null : task.id); }} className="p-1.5 text-brand-text-muted hover:text-brand-text active:scale-95">
                    <MoreVertical size={18} />
                  </button>
                  {openTaskMenuId === task.id && (
                    <div className="absolute right-8 top-8 bg-brand-modal border border-brand-border rounded-lg shadow-xl py-1 z-50 w-32 animate-scale-up">
                      <button onClick={(e) => { e.stopPropagation(); handleEditTaskClick(task); }} className="w-full text-left px-4 py-2 text-xs text-brand-text hover:bg-brand-card-sec">{t('Editar')}</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="w-full text-left px-4 py-2 text-xs text-brand-red hover:bg-brand-card-sec">{t('Eliminar')}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="space-y-2 mt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text-muted px-1">{t('Completadas')}</h3>
            {completedTasks.map(task => (
              <div key={task.id} className="relative flex items-center justify-between p-3 bg-brand-card-sec/50 border border-brand-border/50 rounded-xl">
                <div onClick={() => handleTaskCheck(task.id)} className="flex items-center space-x-3 cursor-pointer flex-1 opacity-50">
                  <CheckCircle2 className="shrink-0 text-brand-green" size={20} />
                  <span className="text-sm font-medium text-brand-text-muted line-through leading-tight">{task.title}</span>
                </div>
                <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-brand-text-muted hover:text-brand-red transition-colors active:scale-95">
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showTaskModal && createPortal(
        <div className="fixed inset-0 bg-brand-bg/40 z-[100] flex items-start justify-center p-4 pt-6 sm:pt-12 animate-overlay-fade-in touch-none backdrop-blur-[2px]">
          <div className="w-full max-w-sm bg-brand-modal dynamic-bg-card backdrop-blur-2xl border border-brand-border rounded-3xl p-6 shadow-2xl shadow-black/50 animate-fade-in text-left mt-safe">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-brand-text">
                {modalTaskMode === 'create' ? t('Añadir Nueva Tarea') : t('Editar Tarea')}
              </h2>
              <button onClick={() => setShowTaskModal(false)} className="text-brand-text-muted hover:text-brand-text">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveModalTask} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">{t('Nombre de la tarea')}</label>
                <input 
                  type="text" 
                  autoFocus
                  value={modalTaskTitle}
                  onChange={e => setModalTaskTitle(e.target.value)}
                  placeholder={t('Ej. Ir al gimnasio...')} 
                  className="w-full premium-input rounded-xl px-4 py-3 text-sm text-brand-text placeholder-brand-text-muted focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">{t('Nivel de Urgencia')}</label>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => setModalTaskPriority(1)} className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-colors ${modalTaskPriority === 1 ? 'bg-brand-red/15 text-brand-red border-brand-red/30' : 'bg-brand-card border-brand-border text-brand-text-muted hover:bg-brand-card-sec'}`}>{t('Urgente')}</button>
                  <button type="button" onClick={() => setModalTaskPriority(2)} className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-colors ${modalTaskPriority === 2 ? 'bg-brand-primary/15 text-brand-primary border-brand-primary/30' : 'bg-brand-card border-brand-border text-brand-text-muted hover:bg-brand-card-sec'}`}>{t('Normal')}</button>
                  <button type="button" onClick={() => setModalTaskPriority(3)} className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-colors ${modalTaskPriority === 3 ? 'bg-brand-card-sec text-brand-text border-brand-border' : 'bg-brand-card border-brand-border text-brand-text-muted hover:bg-brand-card-sec'}`}>{t('Baja')}</button>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full py-3.5 premium-gradient-button text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-primary/20">
                  {modalTaskMode === 'create' ? t('Añadir Tarea') : t('Guardar Cambios')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
