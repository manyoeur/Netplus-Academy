import React, { useState } from 'react';
import { Network, ShieldCheck, Cloud, Activity, Layers } from 'lucide-react';
import thumbRouting from '../../assets/images/course_thumb_routing_1794636856652.jpg';
import thumbSecurity from '../../assets/images/course_thumb_security_1794636856867.jpg';
import thumbCloud from '../../assets/images/course_thumb_cloud_1794636857791.jpg';
import thumbPacket from '../../assets/images/course_thumb_packet_1794636857450.jpg';
import { Course } from '../../types';

export const COURSE_DEFAULT_THUMBNAILS: Record<string, string> = {
  'course-ccna-1': thumbRouting,
  'course-sec-1': thumbSecurity,
  'course-sdwan-1': thumbCloud,
  'course-wireshark-1': thumbPacket
};

export function resolveCourseThumbnail(course: Pick<Course, 'id' | 'category' | 'thumbnail'>): string {
  const raw = (course.thumbnail || '').trim();
  const bundled = COURSE_DEFAULT_THUMBNAILS[course.id];

  // Prefer bundled high-resolution local assets for core courses if stored value is empty or an older external stock URL
  if (bundled && (!raw || raw.includes('images.unsplash.com'))) {
    return bundled;
  }
  if (raw) {
    return raw;
  }

  switch (course.category) {
    case 'Network Security & Firewalls':
      return thumbSecurity;
    case 'Cloud & SD-WAN':
      return thumbCloud;
    case 'Packet Analysis & Forensics':
      return thumbPacket;
    default:
      return thumbRouting;
  }
}

interface CourseThumbnailProps {
  course: Pick<Course, 'id' | 'code' | 'title' | 'category' | 'bannerColor' | 'thumbnail'>;
  className?: string;
  imgClassName?: string;
  showScrim?: boolean;
  children?: React.ReactNode;
}

export const CourseThumbnail: React.FC<CourseThumbnailProps> = ({
  course,
  className = '',
  imgClassName = '',
  showScrim = true,
  children
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const src = resolveCourseThumbnail(course);

  const FallbackIcon =
    course.category === 'Network Security & Firewalls'
      ? ShieldCheck
      : course.category === 'Cloud & SD-WAN'
      ? Cloud
      : course.category === 'Packet Analysis & Forensics'
      ? Activity
      : course.category === 'Automation & NetDevOps'
      ? Layers
      : Network;

  return (
    <div className={`relative overflow-hidden bg-slate-950 select-none ${className}`}>
      {!imgFailed ? (
        <img
          src={src}
          alt={course.title}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgFailed(true)}
          className={`w-full h-full object-cover ${imgClassName}`}
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${
            course.bannerColor || 'from-slate-800 via-blue-950 to-slate-950'
          } flex flex-col items-center justify-center p-4 text-white/85 relative`}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)',
              backgroundSize: '18px 18px'
            }}
          />
          <FallbackIcon className="w-8 h-8 mb-1.5 relative z-10 text-cyan-300" />
          <span className="text-[11px] font-mono font-bold tracking-wider relative z-10">
            {course.code}
          </span>
        </div>
      )}

      {showScrim && (
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent pointer-events-none" />
      )}

      {children}
    </div>
  );
};
