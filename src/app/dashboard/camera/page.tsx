
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, VideoOff, Camera, RotateCw, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

const OPTIMAL_WIDTH = 1280;
const OPTIMAL_HEIGHT = 720;


export default function CameraPage() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const varietyIndex = searchParams.get('varietyIndex');

  useEffect(() => {
    // This page is only for use from the product form now
    if (from !== 'product-form' || varietyIndex === null) {
        toast({
            title: "Invalid Access",
            description: "Please access the camera via the 'Add/Edit Product' page.",
            variant: "destructive"
        });
        router.push('/dashboard/products');
        return;
    }

    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("Media Devices API not available.");
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Not Supported',
          description: 'Your browser does not support camera access.',
        });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();
    
    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [toast, router, from, varietyIndex]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas to the optimal size
      canvas.width = OPTIMAL_WIDTH;
      canvas.height = OPTIMAL_HEIGHT;

      const context = canvas.getContext('2d');
      if (context) {
        // Draw the video frame onto the canvas, resizing it in the process
        context.drawImage(video, 0, 0, OPTIMAL_WIDTH, OPTIMAL_HEIGHT);
        
        // Get the resized image as a data URL (JPEG for better compression)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // 0.9 is the quality factor
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };
  
  const handleUseImage = () => {
    if (!capturedImage) {
        toast({ title: 'No Image Captured', description: 'Please capture an image first.', variant: 'destructive' });
        return;
    }
    
    try {
      // Store the image data in sessionStorage to pass it back to the form
      sessionStorage.setItem('capturedImageData', capturedImage);
      sessionStorage.setItem('capturedImageTargetIndex', varietyIndex!);

      toast({
        title: 'Image Selected',
        description: 'You will now be returned to the product form.',
      });

      // Go back to the previous page (the product form)
      router.back();

    } catch (error) {
      console.error("Error saving to sessionStorage:", error);
      toast({
        title: 'Failed to Select Image',
        description: "There was a problem preparing the image. Please try again.",
        variant: 'destructive',
      });
    }
  };


  return (
    <div className="space-y-6">
        <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
                <h1 className="text-2xl font-bold font-headline">Live Camera</h1>
                <p className="text-muted-foreground">Capture an image for your product variety.</p>
            </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>{capturedImage ? 'Image Preview' : 'Camera Feed'}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="w-full max-w-2xl mx-auto">
                    <div className="aspect-video bg-black rounded-md overflow-hidden relative">
                         <video ref={videoRef} className={`w-full h-full object-cover ${capturedImage ? 'hidden' : ''}`} autoPlay muted playsInline />
                         {capturedImage && (
                             <Image src={capturedImage} alt="Captured preview" fill={true} objectFit="contain" />
                         )}
                         {hasCameraPermission === false && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4">
                                <VideoOff className="h-12 w-12 mb-4" />
                                <p className="font-bold">Camera is off or unavailable.</p>
                            </div>
                         )}
                    </div>
                     {hasCameraPermission === false && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertTitle>Camera Access Required</AlertTitle>
                            <AlertDescription>
                                Please allow camera access in your browser settings to use this feature.
                            </AlertDescription>
                        </Alert>
                    )}
                    {hasCameraPermission === true && (
                        <div className="mt-4 flex justify-center space-x-4">
                            {!capturedImage ? (
                                <Button size="lg" onClick={handleCapture}>
                                    <Camera className="mr-2 h-4 w-4" />
                                    Capture Image
                                </Button>
                            ) : (
                                <>
                                    <Button size="lg" variant="outline" onClick={handleRetake}>
                                        <RotateCw className="mr-2 h-4 w-4" />
                                        Retake
                                    </Button>
                                    <Button size="lg" onClick={handleUseImage}>
                                        <Check className="mr-2 h-4 w-4" />
                                        Use This Image
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>
                <canvas ref={canvasRef} className="hidden"></canvas>
            </CardContent>
        </Card>
    </div>
  );
}
