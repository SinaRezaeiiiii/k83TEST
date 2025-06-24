import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CourseService } from '@/services/CourseService';
import { ReviewService } from '@/services/ReviewService';
import { ReviewDTO, CourseDTO } from '@/types';
import Spinner from '@/components/Spinner';
import StarRating from '@/components/StarRating';
import ReviewCard from '@/components/ReviewCard';
import { ArrowLeft, Calendar, BookOpen } from 'lucide-react';
import { useAuthStore } from '@/services/AuthService';
import { toast } from 'sonner';

const CourseDetail = () => {
  const { id: courseIdFromParams } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { student, isAuthenticated } = useAuthStore();

  const [course, setCourse] = useState<CourseDTO | null>(null);
  const [reviews, setReviews] = useState<ReviewDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [apiAverageRating, setApiAverageRating] = useState<number | undefined>(undefined);

  useEffect(() => {
    const loadData = async () => {
      if (!courseIdFromParams) {
        return;
      }

      try {
        setLoading(true);
        const courseData = await CourseService.getCourseById(courseIdFromParams);

        if (!courseData) {
          toast.error('Course not found');
          setCourse(null);
          return;
        }

        setCourse(courseData);

        // Fetch reviews
        const reviewsData = await ReviewService.getReviewsByCourseId(courseIdFromParams);
        setReviews(reviewsData);
        
        try {
          const avgRating = await ReviewService.getAverageRatingByCourseId(courseIdFromParams);
          // Store the properly converted numerical rating
          setApiAverageRating(avgRating);
          console.log(`Retrieved average rating for course ${courseIdFromParams}:`, avgRating);
        } catch (ratingError) {
          console.error("Error fetching average rating:", ratingError);
        }
      } catch (error) {
        toast.error('Failed to load course details');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [courseIdFromParams, navigate]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated || !student) {
      toast.error('Please login to submit a review');
      navigate('/login');
      return;
    }

    if (!rating) {
      toast.error('Please select a rating');
      return;
    }

    if (!reviewText.trim()) {
      toast.error('Please enter your review');
      return;
    }

    if (!course) return;

    try {
      setSubmitting(true);
      const newReviewData: Omit<ReviewDTO, 'reviewId' | 'createdAt'> = {
        studentMatrNr: student.matriculationNumber,
        courseId: course.id,
        rating,
        reviewText: reviewText,
      };
      
      const newReview = await ReviewService.addReview(newReviewData);

      setReviews(prev => [newReview, ...prev]);
      setRating(0);
      setReviewText('');
      toast.success('Your review has been submitted');
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Spinner size={32} text="Loading course details..." />;
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold">Course not found</h1>
        <Button onClick={() => navigate('/courses')} className="mt-4">
          Back to Courses
        </Button>
      </div>
    );
  }
  
   const averageRating = apiAverageRating !== undefined ? 
    apiAverageRating : 
    (reviews.length > 0
      ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
      : course.avgRating || 0);

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/courses')}
        className="mb-4 pl-0"
      >
        <ArrowLeft size={18} className="mr-1" />
        Back to courses
      </Button>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="md:col-span-2">
          <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
          
          <div className="flex flex-wrap gap-2 mb-6">
            {course.categories.map(category => (
              <Badge key={category.name} variant="secondary">{category.name}</Badge>
            ))}
          </div>
          
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="mr-2 h-5 w-5 text-primary" />
                Course Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line">{course.description}</p>
            </CardContent>
          </Card>
          
          {/* Reviews section */}
          <h2 className="text-2xl font-bold mb-4">Student Reviews</h2>
          
          {/* Review form */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Write a Review</CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmitReview}>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 font-medium">Your Rating</p>
                  <StarRating
                    value={rating}
                    onChange={setRating}
                  />
                </div>
                <div>
                  <Textarea
                    placeholder="Share your experience with this course..."
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={4}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={submitting || !isAuthenticated}>
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </Button>
                {!isAuthenticated && (
                  <p className="text-sm text-muted-foreground ml-4">
                    Please <Button variant="link" className="p-0" onClick={() => navigate('/login')}>login</Button> to submit a review
                  </p>
                )}
              </CardFooter>
            </form>
          </Card>
          
          {/* Review list */}
          {reviews.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <ReviewCard key={review.reviewId} review={review} />
              ))}
            </div>
          )}
        </div>
        
        {/* Sidebar */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Course Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Difficulty:</span>
                <Badge 
                  variant="outline"
                  className={getDifficultyColor(subject.difficulty)}
                >
                  {subject.difficulty}
                </Badge>
              </div> */}
              
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Credits:</span>
                <span className="font-medium">{course.credits} ECTS</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rating:</span>
                <div className="flex items-center">
                  <StarRating value={Number(averageRating) || 0} readonly />
                  <span className="ml-2">
                    ({averageRating !== undefined ? Number(averageRating).toFixed(1) : 'N/A'})
                  </span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex items-center text-muted-foreground mb-1">
                  <Calendar size={16} className="mr-2" />
                  <span className="text-sm">Semester Info</span>
                </div>
                <p className="text-sm">
                  Offered in both Winter and Summer semesters
                </p>
              </div>
              
              {/* <div className="pt-2 border-t">
                <div className="flex items-center text-muted-foreground mb-1">
                  <UnfoldVertical size={16} className="mr-2" />
                  <span className="text-sm">Prerequisites</span>
                </div>
                <PrerequisitesList 
                  subjectId={subject.id} 
                  prerequisites={subject.prerequisites} 
                />
              </div> */}
            </CardContent>
            
            <CardFooter className="flex-col items-stretch gap-2">
              {/* <EnrollmentButton subjectId={subject.id} /> */}
              
              {isAuthenticated ? (
                <Button 
                  onClick={() => navigate('/recommend')}
                  variant="outline"
                  className="w-full"
                >
                  Find Similar Courses
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/login')}
                  variant="default"
                  className="w-full"
                >
                  Login to Get Recommendations
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;
