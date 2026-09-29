import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "react-i18next";
import { Send, Diamond, MoreVertical, Trash2, Edit2, X, MessageSquare, ChevronDown, ChevronUp, Reply, Crown } from 'lucide-react';
import { User, ValuePost, ValueLike, ValueComment } from '../types';
import { 
  getValuePosts, createValuePost, editValuePost, deleteValuePost, 
  getValueLikes, toggleValueLike, getAllUsers, 
  refreshValuePostsFromSupabase, refreshValueLikesFromSupabase,
  getValueComments, refreshValueCommentsFromSupabase, createValueComment, deleteValueComment,
  canUserPostValueToday, canUserCommentToday
} from '../services/db';
import { getAvatarFrame, getNameColor } from '../utils/profileCustomization';
import { supabase } from '../lib/supabaseClient';
import { createPortal } from 'react-dom';

interface ValueBoardViewProps {
  user: User;
  onUserClick: (userId: string) => void;
}

export const ValueBoardView: React.FC<ValueBoardViewProps> = ({ user, onUserClick }) => {
  const { t } = useTranslation();
  const [localRefresh, setLocalRefresh] = useState(0);
  const [newPostContent, setNewPostContent] = useState('');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  
  const [posts, setPosts] = useState<ValuePost[]>(() => getValuePosts());
  const [likes, setLikes] = useState<ValueLike[]>(() => getValueLikes());
  const [comments, setComments] = useState<ValueComment[]>(() => getValueComments());
  
  const [openThreadPostId, setOpenThreadPostId] = useState<string | null>(null);
  const [replyContentMap, setReplyContentMap] = useState<Record<string, string>>({});
  const [replyingToMap, setReplyingToMap] = useState<Record<string, { commentId: string; authorName: string } | null>>({});
  const [commentErrorMsg, setCommentErrorMsg] = useState('');
  
  const allUsers = getAllUsers();
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const syncValueBoard = useCallback(async () => {
    try {
      const [remotePosts, remoteLikes, remoteComments] = await Promise.all([
        refreshValuePostsFromSupabase(),
        refreshValueLikesFromSupabase(user.id),
        refreshValueCommentsFromSupabase()
      ]);
      setPosts(remotePosts);
      setLikes(remoteLikes);
      setComments(remoteComments);
    } catch (e) {
      setPosts(getValuePosts());
      setLikes(getValueLikes());
      setComments(getValueComments());
    }
  }, [user.id]);

  useEffect(() => {
    // 1. Initial sync on mount
    syncValueBoard();

    // 2. Realtime WebSocket subscription (Zero database polling load)
    const channel = supabase
      .channel('public:value_board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'value_posts' }, () => {
        syncValueBoard();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'value_likes' }, () => {
        syncValueBoard();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'value_comments' }, () => {
        syncValueBoard();
      })
      .subscribe();

    // 3. Sync on app focus / screen unlock
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncValueBoard();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', syncValueBoard);

    // 4. Safe passive refresh fallback (every 45s instead of aggressive 3s polling)
    const interval = setInterval(syncValueBoard, 45000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', syncValueBoard);
      clearInterval(interval);
    };
  }, [syncValueBoard]);

  const postEligibility = canUserPostValueToday(user.id);
  const commentEligibility = canUserCommentToday(user.id);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;
    const content = newPostContent.trim();
    setNewPostContent('');
    const res = await createValuePost(content);
    if (res.success) {
      await syncValueBoard();
      setLocalRefresh(prev => prev + 1);
    }
  };

  const handleToggleLike = async (postId: string, authorId: string) => {
    // Optimistic UI update: 0ms latency
    const currentUserId = user.id;
    const existingIndex = likes.findIndex(l => l.post_id === postId && l.user_id === currentUserId);
    const delta = existingIndex >= 0 ? -1 : 1;
    
    let updatedLikes: ValueLike[];
    if (existingIndex >= 0) {
      updatedLikes = likes.filter((_, idx) => idx !== existingIndex);
    } else {
      const optimisticLike: ValueLike = {
        id: `opt_like_${postId}_${currentUserId}`,
        post_id: postId,
        user_id: currentUserId,
        created_at: new Date().toISOString()
      };
      updatedLikes = [...likes, optimisticLike];
    }
    setLikes(updatedLikes);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: Math.max(0, (p.likes_count || 0) + delta) } : p));

    try {
      await toggleValueLike(postId, authorId);
    } catch (e) {
      console.error('Error toggling like:', e);
      await syncValueBoard();
    }
  };

  const handleAddComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    setCommentErrorMsg('');
    const text = (replyContentMap[postId] || '').trim();
    if (!text) return;

    const replyingTo = replyingToMap[postId];
    const optimisticComment: ValueComment = {
      id: 'opt_comm_' + Math.random().toString(36).substr(2, 9),
      post_id: postId,
      user_id: user.id,
      parent_id: replyingTo?.commentId || null,
      reply_to_user_name: replyingTo?.authorName || null,
      author_name: user.name || 'Usuario',
      author_avatar: user.avatar_url || '',
      author_level: user.level || 1,
      content: text,
      created_at: new Date().toISOString()
    };

    // Instant UI update
    setComments(prev => [...prev, optimisticComment]);
    setReplyContentMap(prev => ({ ...prev, [postId]: '' }));
    setReplyingToMap(prev => ({ ...prev, [postId]: null }));

    const res = await createValueComment(postId, text, replyingTo?.commentId, replyingTo?.authorName);
    if (res.success) {
      await syncValueBoard();
      setLocalRefresh(prev => prev + 1);
    } else {
      // Revert if error
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      setCommentErrorMsg(res.message || 'Error al publicar respuesta.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteValueComment(commentId);
    await syncValueBoard();
    setLocalRefresh(prev => prev + 1);
  };

  const confirmDeletePost = (postId: string) => {
    setDeletingPostId(postId);
    setMenuOpenId(null);
  };

  const handleDeletePost = async () => {
    if (deletingPostId) {
      const idToDelete = deletingPostId;
      setDeletingPostId(null);
      await deleteValuePost(idToDelete);
      await syncValueBoard();
      setLocalRefresh(prev => prev + 1);
    }
  };

  const startEditPost = (postId: string, content: string) => {
    setEditingPostId(postId);
    setEditPostContent(content);
    setMenuOpenId(null);
  };

  const saveEditPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPostContent.trim() || !editingPostId) return;
    const id = editingPostId;
    const content = editPostContent.trim();
    setEditingPostId(null);
    await editValuePost(id, content);
    await syncValueBoard();
    setLocalRefresh(prev => prev + 1);
  };

  return (
    <div className="min-w-full w-full flex-shrink-0 snap-center h-full relative flex flex-col overflow-hidden bg-brand-bg">
      <div className="flex items-center justify-between mb-4 px-5 pt-7 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-brand-text tracking-tight mt-0.5">
            {t('Tablón de Valor')}
          </h1>
          <p className="text-xs text-brand-text-muted mt-1">{t('1 reflexión diaria • Reflexiones del Winter Arc')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-24 hide-scrollbar">
        {posts.length === 0 ? (
          <div className="text-center py-10 text-brand-text-muted">
            <p className="text-sm">{t('No hay reflexiones todavía.')}</p>
            <p className="text-xs mt-1">{t('¡Sé el primero en aportar valor!')}</p>
          </div>
        ) : (
          posts.map(post => {
            const author = allUsers.find(u => u.id === post.user_id);
            const postLikes = likes.filter(l => l.post_id === post.id);
            const postComments = comments.filter(c => c.post_id === post.id);
            const hasLiked = postLikes.some(l => l.user_id === user.id);
            const isOwnPost = post.user_id === user.id;
            const isThreadOpen = openThreadPostId === post.id;
            const replyingTo = replyingToMap[post.id];

            const authorFrame = getAvatarFrame(author?.avatar_frame);
            const authorColor = getNameColor(author?.name_color);

            return (
              <div key={post.id} className="bg-brand-card border border-brand-border rounded-2xl p-4 shadow-sm relative">
                <div className="flex items-center justify-between mb-3">
                  <div 
                    className="flex items-center space-x-3 cursor-pointer active:opacity-70 transition-opacity"
                    onClick={() => author && onUserClick(author.id)}
                  >
                    <div className="relative flex-shrink-0">
                      <img 
                        src={author?.avatar_url || ''} 
                        alt="" 
                        className={`w-9 h-9 rounded-full object-cover ${authorFrame.borderClass} ${authorFrame.glowClass}`} 
                      />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <p className={`text-xs font-bold ${authorColor.textClass}`}>{author?.name || 'Usuario'}</p>
                        {author?.title && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                            {author.title}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-brand-text-muted">{new Date(post.created_at).toLocaleDateString()} - {new Date(post.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                  </div>
                  
                  {isOwnPost && (
                    <div className="relative">
                      <button 
                        onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)}
                        className="p-1 text-brand-text-muted hover:text-brand-text"
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {menuOpenId === post.id && (
                        <div className="absolute right-0 top-6 bg-brand-modal border border-brand-border rounded-lg shadow-xl py-1 z-50 w-32">
                          <button 
                            onClick={() => startEditPost(post.id, post.content)}
                            className="w-full text-left px-4 py-2 text-xs text-brand-text hover:bg-brand-card-sec flex items-center gap-2"
                          >
                            <Edit2 size={12} /> {t('Editar')}
                          </button>
                          <button 
                            onClick={() => confirmDeletePost(post.id)}
                            className="w-full text-left px-4 py-2 text-xs text-brand-red hover:bg-brand-card-sec flex items-center gap-2"
                          >
                            <Trash2 size={12} /> {t('Eliminar')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-brand-text mb-4 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                
                {/* Actions: Comments button + Like button */}
                <div className="flex items-center justify-between border-t border-brand-border/50 pt-3">
                  <button
                    onClick={() => setOpenThreadPostId(isThreadOpen ? null : post.id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-brand-card-sec text-brand-text hover:bg-brand-border border border-brand-border/60 cursor-pointer active:scale-95"
                  >
                    <MessageSquare size={13} className="text-brand-text-muted" />
                    <span>{postComments.length} {postComments.length === 1 ? t('respuesta') : t('respuestas')}</span>
                    {isThreadOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {/* Aporta Valor Button */}
                  {isOwnPost ? (
                    <div 
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/25"
                      title={t('Puntos de valor recibidos')}
                    >
                      <Diamond size={13} className="fill-current text-amber-500" />
                      <span>{post.likes_count || 0} {(post.likes_count === 1) ? t('Aporte') : t('Aportes')}</span>
                      {(post.likes_count || 0) > 0 && (
                        <span className="text-[10px] font-extrabold bg-amber-500/20 px-1.5 py-0.2 rounded-md border border-amber-500/30">
                          +{post.likes_count} XP
                        </span>
                      )}
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleToggleLike(post.id, post.user_id)}
                      className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                        hasLiked 
                          ? 'bg-amber-500 text-black font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.35)]' 
                          : 'bg-brand-card-sec text-brand-text hover:bg-brand-border border border-brand-border/60 hover:text-amber-500'
                      }`}
                    >
                      <Diamond size={13} className={hasLiked ? 'fill-current' : 'text-amber-500'} />
                      <span>{t('Aporta valor')}</span>
                    </button>
                  )}
                </div>

                {/* Collapsible Thread Replies */}
                {isThreadOpen && (
                  <div className="mt-3 pt-3 border-t border-brand-border/40 space-y-2.5 animate-fade-in-up">
                    {postComments.length === 0 ? (
                      <p className="text-[11px] text-brand-text-muted text-center py-2">
                        {t('No hay respuestas en este hilo. ¡Sé el primero!')}
                      </p>
                    ) : (
                      postComments.map(comment => {
                        const isOwnComment = comment.user_id === user.id;
                        const commentAuthor = allUsers.find(u => u.id === comment.user_id);
                        const commentFrame = getAvatarFrame(commentAuthor?.avatar_frame);
                        const commentColor = getNameColor(commentAuthor?.name_color);

                        return (
                          <div key={comment.id} className="bg-brand-bg/60 rounded-xl p-2.5 border border-brand-border/40 text-left">
                            <div className="flex items-center justify-between mb-1">
                              <div 
                                className="flex items-center space-x-2 cursor-pointer"
                                onClick={() => onUserClick(comment.user_id)}
                              >
                                <img 
                                  src={comment.author_avatar || commentAuthor?.avatar_url || ''} 
                                  className={`w-6 h-6 rounded-full object-cover ${commentFrame.borderClass} ${commentFrame.glowClass}`} 
                                  alt="" 
                                />
                                <div className="flex items-center space-x-1.5 flex-wrap">
                                  <span className={`text-xs font-bold ${commentColor.textClass}`}>{comment.author_name}</span>
                                  {commentAuthor?.title && (
                                    <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                                      {commentAuthor.title}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setReplyingToMap(prev => ({ ...prev, [post.id]: { commentId: comment.id, authorName: comment.author_name } }))}
                                  className="text-[10px] text-brand-text-muted hover:text-brand-primary flex items-center space-x-0.5 p-1 transition-colors cursor-pointer"
                                  title={t('Responder a este comentario')}
                                >
                                  <Reply size={11} />
                                  <span>{t('Responder')}</span>
                                </button>
                                {isOwnComment && (
                                  <button
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="text-brand-text-muted hover:text-brand-red p-1 transition-colors"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {comment.reply_to_user_name && (
                              <p className="text-[10px] text-brand-primary/80 font-medium pl-7 mb-1">
                                ↳ {t('En respuesta a')} <span className="font-bold">@{comment.reply_to_user_name}</span>
                              </p>
                            )}

                            <p className="text-xs text-brand-text leading-relaxed whitespace-pre-wrap pl-7">
                              {comment.content}
                            </p>
                          </div>
                        );
                      })
                    )}

                    {/* Add Reply Input */}
                    {commentEligibility.canComment ? (
                      <form onSubmit={(e) => handleAddComment(post.id, e)} className="relative pt-1">
                        {replyingTo && (
                          <div className="flex items-center justify-between bg-brand-primary/10 border border-brand-primary/20 rounded-lg px-2.5 py-1 text-[10px] text-brand-primary mb-1.5">
                            <span>{t('Respondiendo a')} <strong>@{replyingTo.authorName}</strong></span>
                            <button 
                              type="button" 
                              onClick={() => setReplyingToMap(prev => ({ ...prev, [post.id]: null }))}
                              className="text-brand-text-muted hover:text-brand-text p-0.5 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-brand-text-muted px-1 mb-1">
                          <span>{replyingTo ? t('Tu respuesta al hilo') : t('Tu respuesta')}</span>
                          <span className="font-bold text-brand-primary">{t('Respuestas restantes hoy')}: {commentEligibility.remaining}/5</span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={replyContentMap[post.id] || ''}
                            onChange={(e) => setReplyContentMap(prev => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder={replyingTo ? `${t('Responder a')} @${replyingTo.authorName}...` : t('Escribe una respuesta constructiva...')}
                            className="w-full bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2.5 pr-10 text-xs text-brand-text focus:outline-none focus:border-brand-primary"
                          />
                          <button
                            type="submit"
                            disabled={!(replyContentMap[post.id] || '').trim()}
                            className="absolute right-1.5 top-1.5 p-1.5 bg-brand-primary text-white rounded-lg disabled:opacity-40 cursor-pointer"
                          >
                            <Send size={13} />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="bg-brand-bg rounded-xl p-2 text-center text-[10px] text-brand-text-muted border border-brand-border/40">
                        {t('Has alcanzado el límite de 5 respuestas de hoy. Vuelve mañana.')}
                      </div>
                    )}

                    {commentErrorMsg && (
                      <p className="text-[10px] text-brand-red text-center">{commentErrorMsg}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Post Creator with 1 post/day limit */}
      <div className="absolute bottom-3 left-0 right-0 px-5 z-20 pointer-events-none">
        <div className="pointer-events-auto">
          {postEligibility.canPost ? (
            <form onSubmit={handlePost} className="relative">
              <input 
                type="text" 
                value={newPostContent}
                onChange={e => setNewPostContent(e.target.value)}
                placeholder={t('Escribe tu reflexión del día (1 al día)...')}
                className="w-full bg-brand-card/90 backdrop-blur-xl border border-brand-primary/40 rounded-full px-5 py-3.5 pr-12 text-sm text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
              />
              <button 
                type="submit"
                disabled={!newPostContent.trim()}
                className="absolute right-2 top-2 p-2 bg-brand-primary text-white rounded-full disabled:opacity-40 disabled:bg-brand-border cursor-pointer shadow-md active:scale-95 transition-all"
              >
                <Send size={16} className="-ml-0.5" />
              </button>
            </form>
          ) : (
            <div className="bg-brand-card/90 backdrop-blur-xl border border-brand-border/80 rounded-2xl p-3 text-center shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
              <p className="text-xs font-semibold text-brand-text-muted">
                ✨ {t('Ya has compartido tu reflexión de hoy. Vuelve mañana para seguir aportando valor.')}
              </p>
            </div>
          )}
        </div>
      </div>

      {editingPostId && createPortal(
        <div className="fixed inset-0 bg-brand-bg/40 z-[100] flex items-center justify-center p-4 animate-overlay-fade-in backdrop-blur-sm">
          <div className="w-full max-w-sm bg-brand-modal border border-brand-border rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold">{t('Editar Reflexión')}</h2>
              <button onClick={() => setEditingPostId(null)}><X size={20}/></button>
            </div>
            <form onSubmit={saveEditPost}>
              <textarea 
                autoFocus
                className="w-full premium-input rounded-xl px-4 py-3 text-sm mb-4 min-h-[100px] resize-none" 
                value={editPostContent}
                onChange={e => setEditPostContent(e.target.value)}
              />
              <button type="submit" className="w-full py-3 premium-gradient-button text-white rounded-xl font-bold">
                {t('Guardar Cambios')}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {deletingPostId && createPortal(
        <div className="fixed inset-0 bg-brand-bg/40 z-[100] flex items-center justify-center p-4 animate-overlay-fade-in backdrop-blur-sm">
          <div className="w-full max-w-xs bg-brand-modal border border-brand-border rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-brand-red/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-brand-red" />
            </div>
            <h2 className="text-lg font-bold text-brand-text mb-2">{t('¿Eliminar reflexión?')}</h2>
            <p className="text-sm text-brand-text-muted mb-6">{t('Esta acción no se puede deshacer y los puntos de valor se perderán.')}</p>
            
            <div className="flex space-x-3">
              <button 
                onClick={() => setDeletingPostId(null)}
                className="flex-1 py-3 bg-brand-card hover:bg-brand-card-sec border border-brand-border text-brand-text rounded-xl font-bold transition-all"
              >
                {t('Cancelar')}
              </button>
              <button 
                onClick={handleDeletePost}
                className="flex-1 py-3 bg-brand-red text-white rounded-xl font-bold hover:bg-brand-red/90 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                {t('Eliminar')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
