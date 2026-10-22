import React, { useState } from 'react';
import { 
  MessageSquare, 
  ThumbsUp, 
  CheckCircle, 
  Plus, 
  Search, 
  Tag, 
  ArrowLeft, 
  Send, 
  Code, 
  Sparkles,
  ShieldCheck,
  Pin
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { ForumPost } from '../../types';

export const DiscussionForum: React.FC = () => {
  const { 
    forumPosts, 
    addForumPost, 
    addForumReply, 
    upvotePost, 
    markAcceptedAnswer, 
    currentUser 
  } = useAcademy();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // New Post Modal
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('CCNA & Routing');
  const [newTags, setNewTags] = useState('OSPF, Cisco');

  // Reply Input
  const [replyText, setReplyText] = useState('');
  const [replyCode, setReplyCode] = useState('');
  const [showCodeBox, setShowCodeBox] = useState(false);

  const categories = [
    'All',
    'CCNA & Routing',
    'Subnetting & Addressing',
    'Packet Analysis',
    'Network Security',
    'Lab Challenges'
  ];

  const filteredPosts = forumPosts.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const selectedPost = forumPosts.find(p => p.id === selectedPostId);

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const tagsArray = newTags.split(',').map(t => t.trim()).filter(Boolean);
    addForumPost(newTitle, newContent, newCategory, tagsArray);
    setNewTitle('');
    setNewContent('');
    setShowNewPostModal(false);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPostId || !replyText.trim()) return;

    addForumReply(selectedPostId, replyText, replyCode ? replyCode : undefined);
    setReplyText('');
    setReplyCode('');
    setShowCodeBox(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono text-xs font-semibold border border-blue-500/30">
              Community Hub
            </span>
            <span className="text-xs text-slate-300">• Peer Learning & Mentorship</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Networking Engineers Discussion Forum
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Collaborate on lab topology puzzles, review packet hex dumps, share CCNA subnetting shortcuts, and seek guidance from CCIE instructors.
          </p>
        </div>

        <button
          onClick={() => setShowNewPostModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Ask Question / Start Thread</span>
        </button>
      </div>

      {/* Main Forum View */}
      {!selectedPost ? (
        <div className="space-y-4">
          
          {/* Categories and Search Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Category tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 text-xs">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search threads or tags..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Posts List */}
          <div className="space-y-3">
            {filteredPosts.map(post => (
              <div
                key={post.id}
                onClick={() => setSelectedPostId(post.id)}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-400 dark:hover:border-cyan-500/50 transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {post.pinned && (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                          <Pin className="w-3 h-3" /> Pinned
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">
                        {post.category}
                      </span>
                      {post.isResolved && (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle className="w-3 h-3" /> Answered
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors">
                      {post.title}
                    </h3>
                  </div>

                  {/* Upvotes badge */}
                  <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    <ThumbsUp className="w-3.5 h-3.5 text-blue-500" />
                    <span>{post.upvotes}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                  {post.content}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <img
                      src={post.author.avatar}
                      alt={post.author.name}
                      className="w-5 h-5 rounded-full object-cover ring-1 ring-blue-500/40"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{post.author.name}</span>
                    <span className="uppercase text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800">
                      {post.author.role}
                    </span>
                    <span>• {new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {post.tags.map(t => (
                        <span key={t} className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-mono">
                      <MessageSquare className="w-3 h-3" />
                      <span>{post.repliesCount} replies</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Detailed Thread View */
        <div className="space-y-6">
          <button
            onClick={() => setSelectedPostId(null)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Discussions</span>
          </button>

          {/* Original Post */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                    {selectedPost.category}
                  </span>
                  {selectedPost.isResolved && (
                    <span className="flex items-center gap-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle className="w-3.5 h-3.5" /> Solved
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedPost.title}
                </h2>
              </div>

              <button
                onClick={() => upvotePost(selectedPost.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                  selectedPost.upvotedByUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>{selectedPost.upvotes} Upvotes</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <img
                src={selectedPost.author.avatar}
                alt={selectedPost.author.name}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedPost.author.name}</span>
              <span className="text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">
                {selectedPost.author.role}
              </span>
              <span>• Posted {new Date(selectedPost.createdAt).toLocaleString()}</span>
            </div>

            <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans">
              {selectedPost.content}
            </div>

            <div className="flex gap-1.5 pt-2">
              {selectedPost.tags.map(t => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* Replies Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <span>Replies & Solutions ({selectedPost.replies.length})</span>
            </h3>

            {selectedPost.replies.map(reply => (
              <div
                key={reply.id}
                className={`p-5 rounded-2xl border space-y-3 transition-all ${
                  reply.isAcceptedAnswer
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={reply.author.avatar}
                      alt={reply.author.name}
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-blue-500/30"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {reply.author.name}
                      </span>
                      <span className="ml-2 text-[10px] font-mono uppercase px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-cyan-400 font-bold">
                        {reply.author.role}
                      </span>
                    </div>
                  </div>

                  {reply.isAcceptedAnswer ? (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-mono font-bold">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      Accepted Solution
                    </span>
                  ) : (
                    (currentUser.role === 'instructor' || currentUser.role === 'admin' || currentUser.name === selectedPost.author.name) && (
                      <button
                        onClick={() => markAcceptedAnswer(selectedPost.id, reply.id)}
                        className="text-[11px] text-slate-500 hover:text-emerald-600 flex items-center gap-1 font-medium"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Mark as Solution</span>
                      </button>
                    )
                  )}
                </div>

                <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {reply.content}
                </div>

                {reply.codeSnippet && (
                  <pre className="p-3 rounded-xl bg-slate-950 text-cyan-400 font-mono text-[11px] overflow-x-auto border border-slate-800">
                    {reply.codeSnippet}
                  </pre>
                )}
              </div>
            ))}

            {/* Post a Reply form */}
            <form onSubmit={handleSendReply} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                Contribute Solution as {currentUser.name}:
              </span>

              <textarea
                rows={3}
                required
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Share your diagnostic advice, route calculation, or explanation..."
                className="w-full p-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {showCodeBox && (
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Cisco IOS CLI Snippet / Configuration:
                  </label>
                  <textarea
                    rows={3}
                    value={replyCode}
                    onChange={(e) => setReplyCode(e.target.value)}
                    placeholder="Router# show ip ospf neighbor..."
                    className="w-full p-2.5 rounded-xl font-mono text-xs bg-slate-950 text-cyan-400 border border-slate-800 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowCodeBox(prev => !prev)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400 font-mono"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>{showCodeBox ? 'Hide Code Box' : 'Add Cisco CLI Snippet'}</span>
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Reply</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Thread Modal */}
      {showNewPostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Create New Discussion Thread
            </h3>

            <form onSubmit={handleCreatePost} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Topic Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {categories.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Why is OSPF stuck in ExStart state over MTU mismatch?"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Content / Topology Details</label>
                <textarea
                  rows={4}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Describe your issue, symptom, or question in detail..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="OSPF, CCNA, MTU, Router"
                  className="w-full px-3 py-2 rounded-xl font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewPostModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Publish Thread
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
