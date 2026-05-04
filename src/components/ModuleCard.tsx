import React from 'react';
import { Eye, Heart, Bookmark } from 'lucide-react';
import { Link } from 'react-router';

export interface ModuleCardProps {
  id: string;
  title: string;
  topic?: string;
  authorName?: string;
  views?: string;
  likes?: string;
  coverImageUrl?: string;
  linkTo: string;
  statusSlot?: React.ReactNode;
  actionMenuSlot?: React.ReactNode;
  isDeleting?: boolean;
}

export function ModuleCard({
  id,
  title,
  topic,
  authorName,
  views = "12.4K",
  likes = "1.2K",
  coverImageUrl,
  linkTo,
  statusSlot,
  actionMenuSlot,
  isDeleting
}: ModuleCardProps) {
  // Try to use the uploaded book_cover.png, assuming the user places it in /public/book_cover.png
  const fallbackImage = '/new_book_cover.png';
  
  return (
    <div className={`relative ${isDeleting ? 'opacity-50 scale-[0.98] pointer-events-none animate-pulse' : ''} transition-all duration-300 w-full`}>
      <Link 
        to={linkTo}
        className="group flex flex-col bg-white rounded-[20px] overflow-hidden border border-gray-200 hover:border-gray-300 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 w-full text-left"
      >
        {/* Cover Image Area */}
        <div className="relative h-[280px] w-full bg-slate-900 overflow-hidden shrink-0">
          <img 
            src={coverImageUrl || fallbackImage} 
            alt={title} 
            className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/60" />
          
          <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6 z-10 mt-4">
            <h2 className="text-white text-[28px] md:text-[32px] font-bold tracking-tight leading-[1.1] uppercase font-sans drop-shadow-xl line-clamp-3" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
              {title || "Untitled Course"}
            </h2>
          </div>
          
          {/* Prevent clicks on slots from triggering the link */}
          <div className="absolute top-4 left-4 z-20 flex gap-2" onClick={(e) => e.preventDefault()}>
              {statusSlot}
          </div>
          <div className="absolute top-4 right-4 z-20" onClick={(e) => e.preventDefault()}>
              {actionMenuSlot}
          </div>
        </div>
        
        {/* Bottom Info Section */}
        <div className="p-5 flex flex-col gap-1 bg-white z-10 relative">
          <h3 className="font-semibold text-gray-900 text-[15px] line-clamp-1 tracking-wide">
            {title || "Untitled Course"}
          </h3>
          <p className="text-gray-500 text-[13px] font-medium flex items-center gap-1 group/author cursor-default">
            by <span className="text-indigo-600 font-semibold group-hover/author:text-indigo-800 transition-colors underline-offset-4 decoration-indigo-200/50 decoration-1 hover:underline">{authorName || 'Anonymous'}</span>
          </p>
          
          <div className="flex items-center text-gray-400 text-[13px] mt-4 font-medium">
            <div className="flex items-center gap-1.5 mr-5">
              <Eye className="w-[18px] h-[18px] opacity-80 text-gray-400" strokeWidth={1.5} /> {views}
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="w-[18px] h-[18px] opacity-80 text-gray-400" strokeWidth={1.5} /> {likes}
            </div>
            <div className="ml-auto cursor-pointer hover:text-gray-900 transition-colors" onClick={(e) => e.preventDefault()}>
              <Bookmark className="w-[18px] h-[18px] opacity-80 text-gray-400" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
