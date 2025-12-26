const fs = require('fs').promises;
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const JOBS_FILE = path.join(__dirname, 'jobs.json');

let jobs = {};

async function loadJobs() {
    try {
        const data = await fs.readFile(JOBS_FILE, 'utf8');
        jobs = JSON.parse(data);
    } catch (error) {
        jobs = {};
    }
}

async function saveJobs() {
    try {
        await fs.writeFile(JOBS_FILE, JSON.stringify(jobs, null, 2));
    } catch (error) {
        console.error('Jobs 저장 실패:', error);
    }
}

async function initJobs() {
    await loadJobs();
}

function createJob(jobId, filename, originalName, size) {
    jobs[jobId] = {
        jobId,
        filename,
        originalName,
        size,
        status: 'processing',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    saveJobs();
    return jobs[jobId];
}

function getJob(jobId) {
    return jobs[jobId] || null;
}

function getAllJobs() {
    return jobs;
}

function updateJobStatus(jobId, status, progress = null) {
    if (!jobs[jobId]) return null;
    jobs[jobId].status = status;
    if (progress !== null) jobs[jobId].progress = progress;
    jobs[jobId].updatedAt = new Date().toISOString();
    if (status === 'completed') {
        jobs[jobId].completedAt = new Date().toISOString();
    }
    saveJobs();
    return jobs[jobId];
}

function generateMockSubtitles(duration = 60, originalLang = 'ko', targetLangs = ['en']) {
    const segments = [];
    const segmentDuration = 3;
    const numSegments = Math.ceil(duration / segmentDuration);
    
    const mockTexts = {
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
            "深層学習は人工ニューラルネットワークを使用した機械学習の一分野です。"
        ],
        zh: [
            "你好，让我们开始今天的讲座。",
            "今天，我们将学习AI技术。",
            "首先，我将解释机器学习的基本概念。",
            "机器学习是一种从数据中学习模式的技术。",
            "深度学习是使用人工神经网络的机器学习的一个领域。"
        ],
        es: [
            "Hola, comencemos la conferencia de hoy.",
            "Hoy aprenderemos sobre tecnología de IA.",
            "Primero, explicaré los conceptos básicos del aprendizaje automático.",
            "El aprendizaje automático es una tecnología que aprende patrones de los datos.",
            "El aprendizaje profundo es un campo del aprendizaje automático que utiliza redes neuronales artificiales."
        ],
        fr: [
            "Bonjour, commençons la conférence d'aujourd'hui.",
            "Aujourd'hui, nous apprendrons sur la technologie de l'IA.",
            "D'abord, j'expliquerai les concepts de base de l'apprentissage automatique.",
            "L'apprentissage automatique est une technologie qui apprend des modèles à partir des données.",
            "L'apprentissage profond est un domaine de l'apprentissage automatique utilisant des réseaux neuronaux artificiels."
        ]
    };
    
    for (let i = 0; i < numSegments; i++) {
        const start = i * segmentDuration;
        const end = Math.min((i + 1) * segmentDuration, duration);
        
        const segment = {
            id: i + 1,
            startTime: start,
            endTime: end,
            speaker: 1
        };
        
        const textIndex = i % (mockTexts[originalLang]?.length || 10);
        segment[originalLang] = mockTexts[originalLang]?.[textIndex] || `세그먼트 ${i + 1}`;
        
        targetLangs.forEach(lang => {
            if (mockTexts[lang] && mockTexts[lang][textIndex]) {
                segment[lang] = mockTexts[lang][textIndex];
            } else {
                segment[lang] = `[${lang}] ${segment[originalLang]}`;
            }
        });
        
        segments.push(segment);
    }
    
    return segments;
}

initJobs();

module.exports = {
    createJob,
    getJob,
    getAllJobs,
    updateJobStatus,
    generateMockSubtitles
};


