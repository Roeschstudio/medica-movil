
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  doctorName: string;
  onReviewSubmitted?: () => void;
}

export function ReviewModal({ 
  isOpen, 
  onClose, 
  appointmentId, 
  doctorName,
  onReviewSubmitted 
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Por favor selecciona una calificación');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId,
          rating,
          comment: comment.trim() || undefined
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al enviar la reseña');
      }

      toast.success('¡Reseña enviada exitosamente!', {
        description: 'Gracias por tu opinión'
      });
      
      onReviewSubmitted?.();
      onClose();
      
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Error al enviar la reseña', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRating(0);
      setHoverRating(0);
      setComment('');
      onClose();
    }
  };

  const StarRating = () => (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="focus:outline-none"
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => setRating(star)}
        >
          <Star
            className={`h-8 w-8 transition-colors ${
              (hoverRating || rating) >= star
                ? 'text-yellow-500 fill-current'
                : 'text-gray-300 hover:text-yellow-400'
            }`}
          />
        </button>
      ))}
    </div>
  );

  const getRatingText = (rating: number) => {
    switch (rating) {
      case 1: return 'Muy malo';
      case 2: return 'Malo';
      case 3: return 'Regular';
      case 4: return 'Bueno';
      case 5: return 'Excelente';
      default: return 'Selecciona tu calificación';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>Calificar Consulta</span>
          </DialogTitle>
          <DialogDescription>
            ¿Cómo fue tu experiencia con <strong>{doctorName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Calificación por estrellas */}
          <div className="text-center space-y-4">
            <div>
              <Label className="text-base font-medium">
                Calificación general
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {getRatingText(hoverRating || rating)}
              </p>
            </div>
            <StarRating />
          </div>

          {/* Comentario opcional */}
          <div className="space-y-2">
            <Label htmlFor="comment">
              Comentario (opcional)
            </Label>
            <Textarea
              id="comment"
              placeholder="Comparte tu experiencia con otros pacientes..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500 caracteres
            </p>
          </div>

          {/* Mensaje informativo */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Tu reseña es importante:</strong> Ayuda a otros pacientes a tomar mejores decisiones y contribuye a mejorar la calidad del servicio médico.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Enviando reseña...
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Enviar Reseña
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
