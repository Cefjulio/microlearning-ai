import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Course, Enrollment } from '../../types';
import ProgressBar from '../../components/shared/ProgressBar';
import { BookOpen, Flame, Trophy } from 'lucide-react';

interface EnrolledCourse {
  enrollment: Enrollment;
  course: Course;
  progress: number;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [enrolled, setEnrolled] = useState<EnrolledCourse[]>([]);
  const [available, setAvailable] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    const [enrollRes, coursesRes, completionsRes] = await Promise.all([
      supabase.from('enrollments').select('*').eq('user_id', user.id),
      supabase.from('courses').select('*').eq('status', 'published'),
      supabase.from('lesson_completions').select('completed_at').eq('user_id', user.id),
    ]);

    const enrollments: Enrollment[] = enrollRes.data ?? [];
    const allCourses: Course[] = coursesRes.data ?? [];
    const completions = completionsRes.data ?? [];

    setTotalCompleted(completions.length);

    // Calculate streak
    const dates = [...new Set(completions.map(c => c.completed_at.split('T')[0]))].sort();
    let currentStreak = 0;
    if (dates.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      let checkDate = today;
      for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] === checkDate) {
          currentStreak++;
          const d = new Date(checkDate);
          d.setDate(d.getDate() - 1);
          checkDate = d.toISOString().split('T')[0];
        } else break;
      }
    }
    setStreak(currentStreak);

    const enrolledCourseIds = new Set(enrollments.map(e => e.course_id));

    // For enrolled courses, calculate progress
    const enrolledCourses: EnrolledCourse[] = [];
    for (const enrollment of enrollments) {
      const course = allCourses.find(c => c.id === enrollment.course_id);
      if (!course) continue;

      const { count: totalCount } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true })
        .in('module_id',
          (await supabase.from('modules').select('id').eq('course_id', course.id)).data?.map(m => m.id) ?? []
        )
        .eq('status', 'published');

      const { count: doneCount } = await supabase
        .from('lesson_completions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('lesson_id',
          (await supabase.from('lessons').select('id')
            .in('module_id',
              (await supabase.from('modules').select('id').eq('course_id', course.id)).data?.map(m => m.id) ?? []
            )).data?.map(l => l.id) ?? []
        );

      enrolledCourses.push({
        enrollment,
        course,
        progress: totalCount ? Math.round(((doneCount ?? 0) / totalCount) * 100) : 0,
      });
    }

    setEnrolled(enrolledCourses);
    setAvailable(allCourses.filter(c => !enrolledCourseIds.has(c.id)));
    setLoading(false);
  };

  const enroll = async (courseId: string) => {
    if (!user) return;
    await supabase.from('enrollments').insert({ user_id: user.id, course_id: courseId });
    navigate(`/courses/${courseId}`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Learning</h1>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <Flame size={24} className="stat-icon orange" />
          <div>
            <p className="stat-value">{streak}</p>
            <p className="stat-label">Day Streak</p>
          </div>
        </div>
        <div className="stat-card">
          <Trophy size={24} className="stat-icon green" />
          <div>
            <p className="stat-value">{totalCompleted}</p>
            <p className="stat-label">Lessons Done</p>
          </div>
        </div>
        <div className="stat-card">
          <BookOpen size={24} className="stat-icon" />
          <div>
            <p className="stat-value">{enrolled.length}</p>
            <p className="stat-label">Enrolled</p>
          </div>
        </div>
      </div>

      {enrolled.length > 0 && (
        <section>
          <h2 className="section-title">Your Journey</h2>
          <div className="course-grid">
            {enrolled.map(({ enrollment, course, progress }) => (
              <div
                key={enrollment.id}
                className="course-card clickable"
                onClick={() => navigate(`/courses/${course.id}`)}
              >
                <div className="course-card-header">
                  <span className="badge published">Enrolled</span>
                </div>
                <h3 className="course-card-title">{course.title}</h3>
                <p className="course-card-topic">{course.topic}</p>
                <p className="course-card-objective text-muted">🎯 {course.objective}</p>
                <ProgressBar percentage={progress} label={`${progress}% complete`} />
                <button className="btn-primary btn-full mt-8">
                  Continue Learning →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {available.length > 0 && (
        <section>
          <h2 className="section-title">Available Courses</h2>
          <div className="course-grid">
            {available.map(course => (
              <div key={course.id} className="course-card">
                <h3 className="course-card-title">{course.title}</h3>
                <p className="course-card-topic">{course.topic}</p>
                {course.description && <p className="course-card-desc">{course.description}</p>}
                <p className="course-card-objective text-muted">🎯 {course.objective}</p>
                <button className="btn-primary btn-full mt-8" onClick={() => enroll(course.id)}>
                  Enroll Now
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && enrolled.length === 0 && available.length === 0 && (
        <div className="empty-state">
          <BookOpen size={48} />
          <h3>No courses available yet</h3>
          <p>Check back soon — new courses are being prepared.</p>
        </div>
      )}
    </div>
  );
}
