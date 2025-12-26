/**
 * 자막 생성 API - Mock Processing
 * 실제 AI 연동 없이 가짜 처리로 자막 생성 시뮬레이션
 */

// 작업 상태
const JobStatus = {
    QUEUED: 'queued',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

// 작업 저장소 (메모리 기반, 실제로는 DB 사용)
const jobs = new Map();

// 더미 자막 텍스트 샘플 (언어별)
const dummySubtitles = {
    ko: [
        "안녕하세요, 오늘 강의를 시작하겠습니다.",
        "오늘은 AI 기술에 대해 알아보겠습니다.",
        "먼저 머신러닝의 기본 개념부터 설명드리겠습니다.",
        "머신러닝은 데이터로부터 패턴을 학습하는 기술입니다.",
        "딥러닝은 인공신경망을 사용한 머신러닝의 한 분야입니다.",
        "이제 실제 사례를 통해 살펴보겠습니다.",
        "자연어 처리 분야에서 많은 발전이 있었습니다.",
        "음성 인식 기술도 크게 향상되었습니다.",
        "이러한 기술들이 우리 일상에 어떻게 적용되는지 알아보겠습니다.",
        "질문이 있으시면 언제든지 말씀해주세요."
    ],
    en: [
        "Hello, let's start today's lecture.",
        "Today, we will learn about AI technology.",
        "First, I'll explain the basic concepts of machine learning.",
        "Machine learning is a technology that learns patterns from data.",
        "Deep learning is a field of machine learning using artificial neural networks.",
        "Now, let's look at real-world examples.",
        "There has been significant progress in natural language processing.",
        "Speech recognition technology has also greatly improved.",
        "Let's see how these technologies are applied in our daily lives.",
        "Please feel free to ask questions at any time."
    ],
    ja: [
        "こんにちは、今日の講義を始めます。",
        "今日はAI技術について学びます。",
        "まず、機械学習の基本概念から説明します。",
        "機械学習はデータからパターンを学習する技術です。",
        "深層学習は人工ニューラルネットワークを使用した機械学習の一分野です。",
        "それでは、実際の事例を見てみましょう。",
        "自然言語処理の分野で多くの進歩がありました。",
        "音声認識技術も大きく向上しました。",
        "これらの技術が私たちの日常生活にどのように適用されているか見てみましょう。",
        "質問があれば、いつでもお聞きください。"
    ],
    zh: [
        "你好，让我们开始今天的讲座。",
        "今天，我们将学习AI技术。",
        "首先，我将解释机器学习的基本概念。",
        "机器学习是一种从数据中学习模式的技术。",
        "深度学习是使用人工神经网络的机器学习的一个领域。",
        "现在，让我们看看实际案例。",
        "在自然语言处理领域取得了重大进展。",
        "语音识别技术也有了很大改进。",
        "让我们看看这些技术如何应用于我们的日常生活。",
        "如有问题，请随时提问。"
    ],
    es: [
        "Hola, comencemos la conferencia de hoy.",
        "Hoy aprenderemos sobre tecnología de IA.",
        "Primero, explicaré los conceptos básicos del aprendizaje automático.",
        "El aprendizaje automático es una tecnología que aprende patrones de los datos.",
        "El aprendizaje profundo es un campo del aprendizaje automático que utiliza redes neuronales artificiales.",
        "Ahora, veamos ejemplos del mundo real.",
        "Ha habido un progreso significativo en el procesamiento del lenguaje natural.",
        "La tecnología de reconocimiento de voz también ha mejorado enormemente.",
        "Veamos cómo se aplican estas tecnologías en nuestra vida diaria.",
        "Por favor, siéntase libre de hacer preguntas en cualquier momento."
    ],
    fr: [
        "Bonjour, commençons la conférence d'aujourd'hui.",
        "Aujourd'hui, nous apprendrons sur la technologie de l'IA.",
        "D'abord, j'expliquerai les concepts de base de l'apprentissage automatique.",
        "L'apprentissage automatique est une technologie qui apprend des modèles à partir des données.",
        "L'apprentissage profond est un domaine de l'apprentissage automatique utilisant des réseaux neuronaux artificiels.",
        "Maintenant, regardons des exemples du monde réel.",
        "Il y a eu des progrès significatifs dans le traitement du langage naturel.",
        "La technologie de reconnaissance vocale s'est également considérablement améliorée.",
        "Voyons comment ces technologies sont appliquées dans notre vie quotidienne.",
        "N'hésitez pas à poser des questions à tout moment."
    ]
};

/**
 * 더미 자막 생성
 * @param {string} languageCode - 언어 코드
 * @param {number} duration - 영상 길이 (초)
 * @param {number} speakers - 화자 수
 * @returns {Array} 자막 배열
 */
function generateDummySubtitles(languageCode, duration, speakers = 1) {
    const subtitles = [];
    const texts = dummySubtitles[languageCode] || dummySubtitles['en'];
    const segmentDuration = 3.5; // 각 자막 세그먼트 길이 (초)
    const numSegments = Math.ceil(duration / segmentDuration);
    
    let currentTime = 0;
    let textIndex = 0;
    
    for (let i = 0; i < numSegments && currentTime < duration; i++) {
        const startTime = currentTime;
        const endTime = Math.min(currentTime + segmentDuration, duration);
        
        // 텍스트 순환 사용
        const text = texts[textIndex % texts.length];
        textIndex++;
        
        subtitles.push({
            id: i + 1,
            startTime: parseFloat(startTime.toFixed(3)),
            endTime: parseFloat(endTime.toFixed(3)),
            text: text,
            speaker: speakers > 1 ? (i % speakers) + 1 : 1,
            confidence: 95 + Math.random() * 5 // 95-100% 신뢰도
        });
        
        currentTime = endTime;
    }
    
    return subtitles;
}

/**
 * 작업 생성
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
function createJob(req, res) {
    try {
        const { videoId, originalLanguage, targetLanguages, speakers = 1, duration } = req.body;
        
        // 필수 파라미터 검증
        if (!videoId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_VIDEO_ID',
                    message: 'videoId는 필수입니다.'
                }
            });
        }
        
        // jobId 생성
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 작업 데이터 생성
        const job = {
            jobId,
            videoId,
            status: JobStatus.QUEUED,
            originalLanguage: originalLanguage || 'auto',
            targetLanguages: targetLanguages || [],
            speakers: parseInt(speakers) || 1,
            duration: parseFloat(duration) || 0,
            progress: 0,
            currentStep: null,
            createdAt: new Date().toISOString(),
            startedAt: null,
            completedAt: null,
            result: null,
            error: null
        };
        
        // 작업 저장
        jobs.set(jobId, job);
        
        // 비동기로 처리 시작 (큐에 추가)
        setTimeout(() => {
            processJob(jobId);
        }, 1000); // 1초 후 처리 시작
        
        // 응답 반환
        res.status(201).json({
            success: true,
            message: '작업이 생성되었습니다.',
            data: {
                jobId: job.jobId,
                videoId: job.videoId,
                status: job.status,
                originalLanguage: job.originalLanguage,
                targetLanguages: job.targetLanguages,
                speakers: job.speakers,
                duration: job.duration,
                createdAt: job.createdAt
            }
        });
    } catch (error) {
        console.error('작업 생성 오류:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '작업 생성 중 오류가 발생했습니다.',
                details: error.message
            }
        });
    }
}

/**
 * 작업 처리 (Mock Processing)
 * @param {string} jobId - 작업 ID
 */
async function processJob(jobId) {
    const job = jobs.get(jobId);
    if (!job) {
        console.error(`작업을 찾을 수 없습니다: ${jobId}`);
        return;
    }
    
    try {
        // 상태를 processing으로 변경
        job.status = JobStatus.PROCESSING;
        job.startedAt = new Date().toISOString();
        job.progress = 0;
        job.currentStep = 'upload';
        jobs.set(jobId, job);
        
        // 처리 시간 시뮬레이션 (영상 길이에 비례)
        // 기본 5초 + 영상 길이(초) * 0.1
        const processingTime = Math.max(5000, 5000 + (job.duration * 100));
        const steps = [
            { name: 'upload', progress: 10, duration: processingTime * 0.1 },
            { name: 'speechRecognition', progress: 50, duration: processingTime * 0.4 },
            { name: 'translation', progress: 90, duration: processingTime * 0.4 },
            { name: 'saving', progress: 100, duration: processingTime * 0.1 }
        ];
        
        // 단계별 처리 시뮬레이션
        for (const step of steps) {
            job.currentStep = step.name;
            job.progress = step.progress;
            jobs.set(jobId, job);
            
            await new Promise(resolve => setTimeout(resolve, step.duration));
        }
        
        // 자막 생성 (더미 데이터)
        const detectedLanguage = job.originalLanguage === 'auto' ? 'ko' : job.originalLanguage;
        const result = {
            videoId: job.videoId,
            detectedLanguage: detectedLanguage,
            originalSubtitles: generateDummySubtitles(detectedLanguage, job.duration, job.speakers),
            translatedSubtitles: {}
        };
        
        // 번역 자막 생성
        for (const targetLang of job.targetLanguages) {
            const langCode = typeof targetLang === 'string' ? targetLang : targetLang.code;
            result.translatedSubtitles[langCode] = generateDummySubtitles(langCode, job.duration, job.speakers);
        }
        
        // 화자 정보 생성
        const speakers = [];
        for (let i = 1; i <= job.speakers; i++) {
            speakers.push({
                id: i,
                name: `Speaker ${i}`
            });
        }
        result.speakers = speakers;
        
        // 작업 완료
        job.status = JobStatus.COMPLETED;
        job.progress = 100;
        job.currentStep = 'completed';
        job.completedAt = new Date().toISOString();
        job.result = result;
        jobs.set(jobId, job);
        
        console.log(`작업 완료: ${jobId}`);
    } catch (error) {
        console.error(`작업 처리 오류 (${jobId}):`, error);
        job.status = JobStatus.FAILED;
        job.error = {
            code: 'PROCESSING_ERROR',
            message: error.message
        };
        jobs.set(jobId, job);
    }
}

/**
 * 작업 조회
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
function getJob(req, res) {
    try {
        const { jobId } = req.params;
        
        const job = jobs.get(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'JOB_NOT_FOUND',
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }
        
        // 응답 데이터 구성
        const responseData = {
            jobId: job.jobId,
            videoId: job.videoId,
            status: job.status,
            progress: job.progress,
            currentStep: job.currentStep,
            originalLanguage: job.originalLanguage,
            detectedLanguage: job.result?.detectedLanguage || null,
            targetLanguages: job.targetLanguages,
            speakers: job.speakers,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt
        };
        
        // 완료된 경우 결과 포함
        if (job.status === JobStatus.COMPLETED && job.result) {
            responseData.result = job.result;
        }
        
        // 실패한 경우 에러 포함
        if (job.status === JobStatus.FAILED && job.error) {
            responseData.error = job.error;
        }
        
        res.status(200).json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('작업 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '작업 조회 중 오류가 발생했습니다.',
                details: error.message
            }
        });
    }
}

/**
 * 작업 목록 조회
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
function getJobs(req, res) {
    try {
        const { status, videoId, page = 1, limit = 20 } = req.query;
        
        // 모든 작업 가져오기
        let jobList = Array.from(jobs.values());
        
        // 필터링
        if (status) {
            jobList = jobList.filter(job => job.status === status);
        }
        if (videoId) {
            jobList = jobList.filter(job => job.videoId === videoId);
        }
        
        // 정렬 (최신순)
        jobList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 페이지네이션
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedJobs = jobList.slice(startIndex, endIndex);
        
        // 응답 데이터 구성 (결과 제외)
        const responseJobs = paginatedJobs.map(job => ({
            jobId: job.jobId,
            videoId: job.videoId,
            status: job.status,
            progress: job.progress,
            currentStep: job.currentStep,
            originalLanguage: job.originalLanguage,
            targetLanguages: job.targetLanguages,
            createdAt: job.createdAt,
            completedAt: job.completedAt
        }));
        
        res.status(200).json({
            success: true,
            data: {
                jobs: responseJobs,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: jobList.length,
                    totalPages: Math.ceil(jobList.length / limitNum)
                }
            }
        });
    } catch (error) {
        console.error('작업 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '작업 목록 조회 중 오류가 발생했습니다.',
                details: error.message
            }
        });
    }
}

/**
 * 작업 취소
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
function cancelJob(req, res) {
    try {
        const { jobId } = req.params;
        
        const job = jobs.get(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'JOB_NOT_FOUND',
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }
        
        // 완료되거나 실패한 작업은 취소 불가
        if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'JOB_CANNOT_BE_CANCELLED',
                    message: '완료되었거나 취소할 수 없는 작업입니다.'
                }
            });
        }
        
        // 작업 취소
        job.status = 'cancelled';
        job.completedAt = new Date().toISOString();
        jobs.set(jobId, job);
        
        res.status(200).json({
            success: true,
            message: '작업이 취소되었습니다.',
            data: {
                jobId: job.jobId,
                status: job.status
            }
        });
    } catch (error) {
        console.error('작업 취소 오류:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '작업 취소 중 오류가 발생했습니다.',
                details: error.message
            }
        });
    }
}

module.exports = {
    createJob,
    getJob,
    getJobs,
    cancelJob,
    JobStatus
};



