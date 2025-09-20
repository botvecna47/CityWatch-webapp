const prisma = require('./database');

class AIService {
  constructor() {
    this.responses = {
      greetings: [
        "Hello! I'm your CityWatch AI assistant. How can I help you today?",
        "Hi there! I'm here to help you stay updated about your city. What would you like to know?",
        "Welcome! I can tell you about the latest happenings in your city. What's on your mind?"
      ],
      cityUpdates: [
        "Here's what's happening in your city right now:",
        "Let me check the latest updates for your city:",
        "Here are the recent developments in your area:"
      ],
      noUpdates: [
        "Things are pretty quiet in your city right now. No major updates to report!",
        "Your city is running smoothly! No recent reports or events to share.",
        "All quiet on the city front! No new updates at the moment."
      ]
    };

    // Authority type analysis keywords and patterns
    this.authorityAnalysis = {
      'Police Department': {
        keywords: ['theft', 'robbery', 'crime', 'vandalism', 'assault', 'fight', 'dispute', 'suspicious', 'illegal', 'drug', 'alcohol', 'noise complaint', 'harassment', 'stolen', 'burglary', 'fraud', 'scam', 'threat', 'violence', 'weapon', 'gun', 'knife', 'riot', 'protest', 'disturbance', 'trespassing', 'break-in'],
        patterns: [/theft|stolen|robbery|burglary/i, /crime|criminal/i, /police|cop|officer/i, /fight|assault|violence/i, /drug|alcohol|drunk/i, /noise|disturbance/i, /suspicious|illegal/i],
        priority: 1
      },
      'Fire Department': {
        keywords: ['fire', 'smoke', 'burning', 'flame', 'explosion', 'gas leak', 'electrical fire', 'wildfire', 'emergency rescue', 'trapped', 'stuck', 'elevator', 'accident', 'collision', 'crash', 'hazard', 'dangerous'],
        patterns: [/fire|burning|smoke|flame/i, /gas leak|explosion/i, /rescue|trapped|stuck/i, /emergency|accident|crash/i, /hazard|dangerous/i],
        priority: 1
      },
      'Medical Services': {
        keywords: ['medical', 'ambulance', 'hospital', 'injured', 'hurt', 'sick', 'unconscious', 'emergency', 'accident', 'fall', 'heart attack', 'stroke', 'bleeding', 'wound', 'health'],
        patterns: [/medical|ambulance|hospital/i, /injured|hurt|sick|unconscious/i, /heart attack|stroke|bleeding/i, /health|medical emergency/i],
        priority: 1
      },
      'Traffic Control': {
        keywords: ['traffic', 'road', 'street', 'highway', 'intersection', 'signal', 'light', 'stop sign', 'speed', 'accident', 'collision', 'parking', 'vehicle', 'car', 'bus', 'truck', 'motorcycle', 'bicycle', 'pedestrian', 'crosswalk'],
        patterns: [/traffic|road|street|highway/i, /signal|light|stop sign/i, /accident|collision/i, /parking|vehicle|car/i, /pedestrian|crosswalk/i],
        priority: 2
      },
      'Emergency Services': {
        keywords: ['emergency', 'urgent', 'immediate', 'danger', 'hazard', 'disaster', 'flood', 'storm', 'earthquake', 'power outage', 'blackout', 'gas leak', 'water leak', 'sewage', 'flooding'],
        patterns: [/emergency|urgent|immediate/i, /danger|hazard|disaster/i, /flood|storm|earthquake/i, /power outage|blackout/i, /gas leak|water leak|sewage/i],
        priority: 1
      },
      'Municipal Services': {
        keywords: ['city hall', 'mayor', 'council', 'permit', 'license', 'complaint', 'administration', 'bureaucracy', 'government', 'public service', 'citizen service'],
        patterns: [/city hall|mayor|council/i, /permit|license/i, /administration|government/i, /public service|citizen service/i],
        priority: 3
      },
      'Environmental Services': {
        keywords: ['pollution', 'environment', 'air quality', 'water quality', 'waste', 'garbage', 'recycling', 'contamination', 'toxic', 'chemical', 'oil spill', 'litter', 'cleanup'],
        patterns: [/pollution|environment|air quality|water quality/i, /waste|garbage|recycling/i, /contamination|toxic|chemical/i, /oil spill|litter|cleanup/i],
        priority: 2
      },
      'Public Works': {
        keywords: ['infrastructure', 'construction', 'maintenance', 'repair', 'pothole', 'sidewalk', 'street light', 'bridge', 'building', 'facility', 'utilities', 'water line', 'sewer', 'drainage'],
        patterns: [/infrastructure|construction|maintenance|repair/i, /pothole|sidewalk|street light/i, /bridge|building|facility/i, /utilities|water line|sewer|drainage/i],
        priority: 2
      },
      'Animal Control': {
        keywords: ['animal', 'dog', 'cat', 'stray', 'wild', 'bite', 'attack', 'noise', 'barking', 'roaming', 'abandoned', 'neglected', 'pest', 'vermin', 'rodent', 'raccoon', 'skunk'],
        patterns: [/animal|dog|cat|stray|wild/i, /bite|attack/i, /barking|roaming/i, /abandoned|neglected/i, /pest|vermin|rodent/i],
        priority: 2
      },
      'Building Inspection': {
        keywords: ['building', 'structure', 'safety', 'code', 'violation', 'construction', 'renovation', 'permit', 'inspection', 'unsafe', 'damaged', 'collapsed', 'leaning', 'cracked'],
        patterns: [/building|structure|safety|code/i, /violation|construction|renovation/i, /permit|inspection/i, /unsafe|damaged|collapsed/i, /leaning|cracked/i],
        priority: 2
      }
    };
  }

  // Generate greeting response
  getGreeting() {
    const randomIndex = Math.floor(Math.random() * this.responses.greetings.length);
    return this.responses.greetings[randomIndex];
  }

  // Analyze report content to determine both category and appropriate authority type
  async analyzeReportContent(title, description) {
    try {
      const combinedText = `${title} ${description}`.toLowerCase();
      
      // First, determine the category
      const categoryAnalysis = this.analyzeCategory(combinedText);
      
      // Then determine the authority type based on content and detected category
      const authorityAnalysis = await this.analyzeAuthorityType(combinedText, categoryAnalysis.category);
      
      return {
        category: categoryAnalysis.category,
        categoryConfidence: categoryAnalysis.confidence,
        categoryReasoning: categoryAnalysis.reasoning,
        authorityType: authorityAnalysis.authorityType,
        authorityConfidence: authorityAnalysis.confidence,
        authorityReasoning: authorityAnalysis.reasoning,
        alternativeOptions: authorityAnalysis.alternativeOptions
      };

    } catch (error) {
      console.error('Error analyzing report content:', error);
      return {
        category: 'OTHER',
        categoryConfidence: 0.1,
        categoryReasoning: 'Error in analysis, defaulting to OTHER category',
        authorityType: 'Municipal Services',
        authorityConfidence: 0.1,
        authorityReasoning: 'Error in analysis, defaulting to Municipal Services'
      };
    }
  }

  // Analyze category from content
  analyzeCategory(text) {
    const categoryScores = {
      'GARBAGE': 0,
      'ROAD': 0,
      'WATER': 0,
      'POWER': 0,
      'OTHER': 0
    };

    // GARBAGE category keywords
    const garbageKeywords = ['garbage', 'trash', 'waste', 'rubbish', 'litter', 'dump', 'landfill', 'recycling', 'bin', 'dustbin', 'cleanup', 'pollution', 'contamination'];
    const garbagePatterns = [/garbage|trash|waste|rubbish|litter/i, /dump|landfill|cleanup/i, /pollution|contamination/i];

    // ROAD category keywords
    const roadKeywords = ['road', 'street', 'highway', 'pothole', 'traffic', 'intersection', 'signal', 'light', 'stop sign', 'speed', 'accident', 'collision', 'parking', 'vehicle', 'car', 'bus', 'truck', 'motorcycle', 'bicycle', 'pedestrian', 'crosswalk', 'sidewalk'];
    const roadPatterns = [/road|street|highway|pothole/i, /traffic|intersection|signal|light/i, /accident|collision|parking/i, /vehicle|car|bus|truck/i, /pedestrian|crosswalk|sidewalk/i];

    // WATER category keywords
    const waterKeywords = ['water', 'pipe', 'leak', 'flood', 'sewage', 'drainage', 'tap', 'faucet', 'contamination', 'quality', 'supply', 'pressure', 'overflow', 'clogged', 'blocked'];
    const waterPatterns = [/water|pipe|leak|flood/i, /sewage|drainage/i, /tap|faucet/i, /contamination|quality|supply/i, /overflow|clogged|blocked/i];

    // POWER category keywords
    const powerKeywords = ['power', 'electricity', 'electrical', 'outage', 'blackout', 'light', 'lamp', 'street light', 'traffic light', 'signal', 'wire', 'cable', 'transformer', 'pole', 'circuit'];
    const powerPatterns = [/power|electricity|electrical/i, /outage|blackout/i, /light|lamp|street light/i, /traffic light|signal/i, /wire|cable|transformer/i];

    // Score each category
    for (const keyword of garbageKeywords) {
      if (text.includes(keyword)) categoryScores.GARBAGE += 2;
    }
    for (const pattern of garbagePatterns) {
      if (pattern.test(text)) categoryScores.GARBAGE += 3;
    }

    for (const keyword of roadKeywords) {
      if (text.includes(keyword)) categoryScores.ROAD += 2;
    }
    for (const pattern of roadPatterns) {
      if (pattern.test(text)) categoryScores.ROAD += 3;
    }

    for (const keyword of waterKeywords) {
      if (text.includes(keyword)) categoryScores.WATER += 2;
    }
    for (const pattern of waterPatterns) {
      if (pattern.test(text)) categoryScores.WATER += 3;
    }

    for (const keyword of powerKeywords) {
      if (text.includes(keyword)) categoryScores.POWER += 2;
    }
    for (const pattern of powerPatterns) {
      if (pattern.test(text)) categoryScores.POWER += 3;
    }

    // Find the category with highest score
    const sortedCategories = Object.entries(categoryScores)
      .sort(([,a], [,b]) => b - a);

    const [selectedCategory, score] = sortedCategories[0];
    const maxPossibleScore = 20; // Rough estimate
    const confidence = Math.min(score / maxPossibleScore, 1);

    // Generate reasoning
    let reasoning = '';
    if (score === 0) {
      reasoning = 'No specific category identified from content, defaulting to OTHER';
    } else {
      const matchedKeywords = [];
      switch (selectedCategory) {
        case 'GARBAGE':
          matchedKeywords.push(...garbageKeywords.filter(k => text.includes(k)));
          break;
        case 'ROAD':
          matchedKeywords.push(...roadKeywords.filter(k => text.includes(k)));
          break;
        case 'WATER':
          matchedKeywords.push(...waterKeywords.filter(k => text.includes(k)));
          break;
        case 'POWER':
          matchedKeywords.push(...powerKeywords.filter(k => text.includes(k)));
          break;
      }
      reasoning = `Content suggests ${selectedCategory} category based on keywords: ${matchedKeywords.slice(0, 3).join(', ')}`;
    }

    return {
      category: selectedCategory,
      confidence: confidence,
      reasoning: reasoning
    };
  }

  // Analyze authority type (updated to work with detected category)
  async analyzeAuthorityType(text, category) {
    const scores = {};

    // Calculate scores for each authority type
    for (const [authorityType, config] of Object.entries(this.authorityAnalysis)) {
      let score = 0;

      // Check keywords
      for (const keyword of config.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score += 2; // Higher weight for exact keyword matches
        }
      }

      // Check patterns
      for (const pattern of config.patterns) {
        if (pattern.test(text)) {
          score += 3; // Higher weight for pattern matches
        }
      }

      // Category-based scoring
      switch (category) {
        case 'GARBAGE':
          if (authorityType === 'Environmental Services') score += 5;
          if (authorityType === 'Public Works') score += 3;
          break;
        case 'ROAD':
          if (authorityType === 'Traffic Control') score += 5;
          if (authorityType === 'Public Works') score += 4;
          break;
        case 'WATER':
          if (authorityType === 'Public Works') score += 5;
          if (authorityType === 'Environmental Services') score += 3;
          break;
        case 'POWER':
          if (authorityType === 'Emergency Services') score += 5;
          if (authorityType === 'Public Works') score += 3;
          break;
        case 'OTHER':
          // No specific category bonus for OTHER
          break;
      }

      // Priority-based scoring (lower priority number = higher priority)
      score += (4 - config.priority) * 0.5;

      scores[authorityType] = score;
    }

    // Find the authority type with highest score
    const sortedScores = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .filter(([,score]) => score > 0);

    if (sortedScores.length === 0) {
      // Default to Municipal Services if no clear match
      return {
        authorityType: 'Municipal Services',
        confidence: 0.3,
        reasoning: 'No specific authority type identified, defaulting to Municipal Services'
      };
    }

    const [selectedAuthority, score] = sortedScores[0];
    const maxPossibleScore = 15; // Rough estimate of maximum possible score
    const confidence = Math.min(score / maxPossibleScore, 1);

    // Get reasoning for the selection
    const reasoning = this.generateReasoning(selectedAuthority, '', '', category);

    return {
      authorityType: selectedAuthority,
      confidence: confidence,
      reasoning: reasoning,
      alternativeOptions: sortedScores.slice(1, 3).map(([type, score]) => ({
        type,
        confidence: Math.min(score / maxPossibleScore, 1)
      }))
    };
  }

  // Legacy method for backward compatibility
  async analyzeReportAuthority(title, description, category) {
    const analysis = await this.analyzeContent(title, description);
    return {
      authorityType: analysis.authorityType,
      confidence: analysis.authorityConfidence,
      reasoning: analysis.authorityReasoning,
      alternativeOptions: analysis.alternativeOptions
    };
  }

  // Generate reasoning for authority type selection
  generateReasoning(authorityType, title, description, category) {
    const reasons = [];

    // Category-based reasoning
    switch (category) {
      case 'GARBAGE':
        if (authorityType === 'Environmental Services') {
          reasons.push('Report involves waste management or environmental concerns');
        } else if (authorityType === 'Public Works') {
          reasons.push('Report involves municipal infrastructure or public services');
        }
        break;
      case 'ROAD':
        if (authorityType === 'Traffic Control') {
          reasons.push('Report involves traffic or road safety issues');
        } else if (authorityType === 'Public Works') {
          reasons.push('Report involves road infrastructure maintenance');
        }
        break;
      case 'WATER':
        if (authorityType === 'Public Works') {
          reasons.push('Report involves water infrastructure or utilities');
        } else if (authorityType === 'Environmental Services') {
          reasons.push('Report involves water quality or environmental concerns');
        }
        break;
      case 'POWER':
        if (authorityType === 'Emergency Services') {
          reasons.push('Report involves power outages or electrical emergencies');
        } else if (authorityType === 'Public Works') {
          reasons.push('Report involves electrical infrastructure');
        }
        break;
    }

    // Content-based reasoning
    const combinedText = `${title} ${description}`.toLowerCase();
    const authorityConfig = this.authorityAnalysis[authorityType];

    if (authorityConfig) {
      // Check for keyword matches
      const matchedKeywords = authorityConfig.keywords.filter(keyword => 
        combinedText.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        reasons.push(`Content contains relevant keywords: ${matchedKeywords.slice(0, 3).join(', ')}`);
      }

      // Check for pattern matches
      const matchedPatterns = authorityConfig.patterns.filter(pattern => 
        pattern.test(combinedText)
      );

      if (matchedPatterns.length > 0) {
        reasons.push('Content matches known patterns for this authority type');
      }
    }

    // Default reasoning if no specific reasons found
    if (reasons.length === 0) {
      reasons.push(`Report type and content suggest ${authorityType} is most appropriate`);
    }

    return reasons.join('; ');
  }

  // Get latest city updates
  async getCityUpdates(userCityId, limit = 5) {
    try {
      const city = await prisma.city.findUnique({
        where: { id: userCityId },
        select: { name: true }
      });

      if (!city) {
        return "I couldn't find your city information. Please make sure your city is set correctly.";
      }

      // Get latest reports
      const latestReports = await prisma.report.findMany({
        where: { 
          cityId: userCityId
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          status: true,
          createdAt: true,
          author: {
            select: { firstName: true, lastName: true }
          }
        }
      });

      // Get upcoming events
      const upcomingEvents = await prisma.event.findMany({
        where: { 
          cityId: userCityId,
          dateTime: { gte: new Date() }
        },
        orderBy: { dateTime: 'asc' },
        take: 3,
        select: {
          id: true,
          title: true,
          description: true,
          dateTime: true,
          location: true
        }
      });

      // Get active alerts
      const activeAlerts = await prisma.alert.findMany({
        where: { 
          cityId: userCityId,
          deleted: false
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          title: true,
          message: true,
          createdAt: true
        }
      });

      return this.formatCityUpdates(city.name, latestReports, upcomingEvents, activeAlerts);
    } catch (error) {
      console.error('Error getting city updates:', error);
      return "Sorry, I'm having trouble accessing the latest city information right now. Please try again later.";
    }
  }

  // Format city updates into natural language
  formatCityUpdates(cityName, reports, events, alerts) {
    let response = `🏙️ **Latest Updates for ${cityName}**\n\n`;

    // Add reports
    if (reports.length > 0) {
      response += "📋 **Recent Reports:**\n";
      reports.forEach((report, index) => {
        const timeAgo = this.getTimeAgo(report.createdAt);
        const author = `${report.author.firstName} ${report.author.lastName}`;
        response += `${index + 1}. **${report.title}** (${report.category})\n`;
        response += `   Status: ${report.status} | Reported by ${author} ${timeAgo}\n`;
        if (report.description && report.description.length > 100) {
          response += `   ${report.description.substring(0, 100)}...\n`;
        } else if (report.description) {
          response += `   ${report.description}\n`;
        }
        response += "\n";
      });
    }

    // Add events
    if (events.length > 0) {
      response += "🎉 **Upcoming Events:**\n";
      events.forEach((event, index) => {
        const eventDate = new Date(event.dateTime).toLocaleDateString();
        response += `${index + 1}. **${event.title}**\n`;
        response += `   📅 ${eventDate}`;
        if (event.location) {
          response += ` | 📍 ${event.location}`;
        }
        response += "\n";
        if (event.description && event.description.length > 80) {
          response += `   ${event.description.substring(0, 80)}...\n`;
        } else if (event.description) {
          response += `   ${event.description}\n`;
        }
        response += "\n";
      });
    }

    // Add alerts
    if (alerts.length > 0) {
      response += "⚠️ **Active Alerts:**\n";
      alerts.forEach((alert, index) => {
        const timeAgo = this.getTimeAgo(alert.createdAt);
        response += `${index + 1}. ⚠️ **${alert.title}**\n`;
        response += `   ${alert.message}\n`;
        response += `   Posted ${timeAgo}\n\n`;
      });
    }

    // If no updates
    if (reports.length === 0 && events.length === 0 && alerts.length === 0) {
      const randomIndex = Math.floor(Math.random() * this.responses.noUpdates.length);
      response = this.responses.noUpdates[randomIndex];
    }

    return response;
  }

  // Get time ago string
  getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  }

  // Get severity emoji
  getSeverityEmoji(severity) {
    switch (severity) {
      case 'LOW': return '🟢';
      case 'MEDIUM': return '🟡';
      case 'HIGH': return '🟠';
      case 'CRITICAL': return '🔴';
      default: return '⚪';
    }
  }

  // Process user message and generate response
  async processMessage(message, user) {
    const lowerMessage = message.toLowerCase().trim();

    // Greeting patterns
    if (this.isGreeting(lowerMessage)) {
      return this.getGreeting();
    }

    // Latest alerts patterns
    if (this.isAlertsQuery(lowerMessage)) {
      if (!user.cityId) {
        return "I'd love to show you the latest alerts, but I need to know which city you're in. Please set your city in your profile settings first.";
      }
      return await this.getLatestAlerts(user.cityId);
    }

    // User reports patterns
    if (this.isUserReportsQuery(lowerMessage)) {
      return await this.getUserReports(user.id);
    }

    // Upcoming events patterns
    if (this.isEventsQuery(lowerMessage)) {
      if (!user.cityId) {
        return "I'd love to show you upcoming events, but I need to know which city you're in. Please set your city in your profile settings first.";
      }
      return await this.getUpcomingEvents(user.cityId);
    }

    // City updates patterns
    if (this.isCityUpdateQuery(lowerMessage)) {
      if (!user.cityId) {
        return "I'd love to tell you about your city updates, but I need to know which city you're in. Please set your city in your profile settings first.";
      }
      return await this.getCityUpdates(user.cityId);
    }

    // Help patterns
    if (this.isHelpQuery(lowerMessage)) {
      return this.getHelpResponse();
    }

    // Default response
    return this.getDefaultResponse();
  }

  // Check if message is a greeting
  isGreeting(message) {
    const greetingPatterns = [
      'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
      'greetings', 'howdy', 'what\'s up', 'how are you'
    ];
    return greetingPatterns.some(pattern => message.includes(pattern));
  }

  // Check if message is asking for alerts
  isAlertsQuery(message) {
    const alertPatterns = [
      'alerts', 'alert', 'warnings', 'warning', 'emergency', 'emergencies',
      'latest alerts', 'recent alerts', 'active alerts', 'show alerts',
      'any alerts', 'alert me', 'alert updates'
    ];
    return alertPatterns.some(pattern => message.includes(pattern));
  }

  // Check if message is asking about user's reports
  isUserReportsQuery(message) {
    const reportPatterns = [
      'my reports', 'my report', 'reports i created', 'my submissions',
      'status of my reports', 'my report status', 'reports i made',
      'show my reports', 'my report updates', 'my submitted reports'
    ];
    return reportPatterns.some(pattern => message.includes(pattern));
  }

  // Check if message is asking for events
  isEventsQuery(message) {
    const eventPatterns = [
      'events', 'event', 'upcoming events', 'today events', 'events today',
      'events later', 'events soon', 'what events', 'show events',
      'city events', 'local events', 'community events', 'event schedule'
    ];
    return eventPatterns.some(pattern => message.includes(pattern));
  }

  // Check if message is asking for city updates
  isCityUpdateQuery(message) {
    const updatePatterns = [
      'what\'s new', 'whats new', 'latest', 'recent', 'updates', 'happenings',
      'going on', 'news', 'city updates', 'anything new', 'what\'s happening', 
      'whats happening', 'city news', 'local news'
    ];
    return updatePatterns.some(pattern => message.includes(pattern));
  }

  // Check if message is asking for help
  isHelpQuery(message) {
    const helpPatterns = [
      'help', 'assist', 'support', 'how to', 'what can you do', 'commands',
      'features', 'guide', 'tutorial'
    ];
    return helpPatterns.some(pattern => message.includes(pattern));
  }

  // Get help response
  getHelpResponse() {
    return `🤖 **I can help you with:**

🚨 **Latest Alerts** - Ask "Latest alerts" to see the 2 most recent alerts in your city

📝 **Your Reports** - Ask "Show my reports" to see your submitted reports and their status updates

🎉 **Upcoming Events** - Ask "Upcoming events" to see events happening today or tomorrow

📋 **City Updates** - Ask "What's new in the city?" for a general overview

🎯 **Try asking:**
• "Latest alerts"
• "Show my reports" 
• "Upcoming events"
• "What's new in the city?"

💡 **Tips:**
• I show real-time data from your city
• Make sure your city is set in your profile
• I give friendly, short, and clear answers

Just ask me anything about your city! 🏙️`;
  }

  // Get default response
  getDefaultResponse() {
    const responses = [
      "I'm not sure I understand that. Try asking me about 'latest alerts', 'my reports', 'upcoming events', or 'what's new in the city'!",
      "I'm here to help with city information! Ask me about alerts, your reports, events, or general city updates.",
      "I can tell you about alerts, your reports, upcoming events, or city news. Try asking 'help' to see all options!",
      "I'm your city assistant! I can show you alerts, your reports, events, or city updates. What would you like to know?"
    ];
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
  }

  // Get latest alerts for a city
  async getLatestAlerts(cityId) {
    try {
      const city = await prisma.city.findUnique({
        where: { id: cityId },
        select: { name: true }
      });

      if (!city) {
        return "I couldn't find your city information. Please make sure your city is set correctly.";
      }

      const alerts = await prisma.alert.findMany({
        where: { 
          cityId: cityId,
          deleted: false
        },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: {
          id: true,
          title: true,
          message: true,
          createdAt: true
        }
      });

      if (alerts.length === 0) {
        return `🚨 **Latest Alerts for ${city.name}**\n\nGood news! There are no active alerts in your city right now. Everything looks safe! 😊`;
      }

      let response = `🚨 **Latest Alerts for ${city.name}**\n\n`;
      alerts.forEach((alert, index) => {
        const timeAgo = this.getTimeAgo(alert.createdAt);
        response += `${index + 1}. **${alert.title}**\n`;
        response += `   ${alert.message}\n`;
        response += `   Posted ${timeAgo}\n\n`;
      });

      return response;
    } catch (error) {
      console.error('Error getting latest alerts:', error);
      return "Sorry, I'm having trouble accessing the latest alerts right now. Please try again later.";
    }
  }

  // Get user's reports with status updates
  async getUserReports(userId) {
    try {
      const reports = await prisma.report.findMany({
        where: { 
          authorId: userId
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          authorityUpdates: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              text: true,
              newStatus: true,
              createdAt: true,
              authority: {
                select: { username: true }
              }
            }
          }
        }
      });

      if (reports.length === 0) {
        return "📝 **Your Reports**\n\nYou haven't submitted any reports yet. Create your first report to track city issues!";
      }

      let response = "📝 **Your Recent Reports**\n\n";
      reports.forEach((report, index) => {
        const timeAgo = this.getTimeAgo(report.createdAt);
        const statusEmoji = this.getStatusEmoji(report.status);
        
        response += `${index + 1}. ${statusEmoji} **${report.title}**\n`;
        response += `   Status: ${report.status.replace('_', ' ')}\n`;
        response += `   Submitted ${timeAgo}\n`;
        
        if (report.authorityUpdates.length > 0) {
          const latestUpdate = report.authorityUpdates[0];
          const updateTimeAgo = this.getTimeAgo(latestUpdate.createdAt);
          response += `   Latest update: "${latestUpdate.text}"\n`;
          response += `   By ${latestUpdate.authority.username} ${updateTimeAgo}\n`;
        }
        response += "\n";
      });

      return response;
    } catch (error) {
      console.error('Error getting user reports:', error);
      return "Sorry, I'm having trouble accessing your reports right now. Please try again later.";
    }
  }

  // Get upcoming events for a city
  async getUpcomingEvents(cityId) {
    try {
      const city = await prisma.city.findUnique({
        where: { id: cityId },
        select: { name: true }
      });

      if (!city) {
        return "I couldn't find your city information. Please make sure your city is set correctly.";
      }

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const events = await prisma.event.findMany({
        where: { 
          cityId: cityId,
          dateTime: { 
            gte: now,
            lte: tomorrow
          }
        },
        orderBy: { dateTime: 'asc' },
        take: 5,
        select: {
          id: true,
          title: true,
          description: true,
          dateTime: true,
          location: true
        }
      });

      if (events.length === 0) {
        return `🎉 **Upcoming Events in ${city.name}**\n\nNo events scheduled for today or tomorrow. Check back later for new events!`;
      }

      let response = `🎉 **Upcoming Events in ${city.name}**\n\n`;
      events.forEach((event, index) => {
        const eventDate = new Date(event.dateTime);
        const isToday = eventDate.toDateString() === now.toDateString();
        const timeStr = eventDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        response += `${index + 1}. **${event.title}**\n`;
        response += `   📅 ${isToday ? 'Today' : 'Tomorrow'} at ${timeStr}\n`;
        if (event.location) {
          response += `   📍 ${event.location}\n`;
        }
        if (event.description && event.description.length > 80) {
          response += `   ${event.description.substring(0, 80)}...\n`;
        } else if (event.description) {
          response += `   ${event.description}\n`;
        }
        response += "\n";
      });

      return response;
    } catch (error) {
      console.error('Error getting upcoming events:', error);
      return "Sorry, I'm having trouble accessing upcoming events right now. Please try again later.";
    }
  }

  // Get status emoji for reports
  getStatusEmoji(status) {
    switch (status) {
      case 'OPEN': return '🔴';
      case 'IN_PROGRESS': return '🟡';
      case 'RESOLVED': return '🟢';
      case 'CLOSED': return '⚫';
      default: return '⚪';
    }
  }

  // Get smart suggestions based on user's city
  async getSmartSuggestions(userCityId) {
    try {
      const suggestions = [
        { text: "What's new in the city?", type: "query" },
        { text: "Show my reports", type: "action" },
        { text: "Latest alerts", type: "action" },
        { text: "Upcoming events", type: "action" }
      ];

      // Add city-specific suggestions if we have data
      if (userCityId) {
        const reportCount = await prisma.report.count({
          where: { cityId: userCityId }
        });

        if (reportCount > 0) {
          suggestions.push({ text: `View all ${reportCount} reports`, type: "action" });
        }
      }

      return suggestions;
    } catch (error) {
      console.error('Error getting smart suggestions:', error);
      return [
        { text: "What's new in the city?", type: "query" },
        { text: "Show my reports", type: "action" },
        { text: "Help", type: "action" }
      ];
    }
  }

  // Analyze user report content to determine priority and category
  async analyzeUserReport({ type, reason, description, evidenceUrls = [] }) {
    try {
      console.log('🤖 AI: Analyzing user report...', { type, reason, description });

      const combinedText = `${reason} ${description}`.toLowerCase();
      
      // Priority analysis based on keywords and content
      let priority = 'MEDIUM';
      let confidence = 0.5;
      let reasoning = '';

      // High priority indicators
      const highPriorityKeywords = [
        'harassment', 'threat', 'dangerous', 'illegal', 'fraud', 'scam',
        'abuse', 'violence', 'inappropriate', 'spam', 'fake'
      ];

      // Urgent priority indicators
      const urgentPriorityKeywords = [
        'emergency', 'immediate', 'urgent', 'threat', 'danger', 'harm',
        'safety', 'security', 'illegal', 'criminal'
      ];

      // Count keyword matches
      const urgentMatches = urgentPriorityKeywords.filter(keyword => 
        combinedText.includes(keyword)
      ).length;
      
      const highMatches = highPriorityKeywords.filter(keyword => 
        combinedText.includes(keyword)
      ).length;

      // Evidence factor
      const evidenceFactor = evidenceUrls.length > 0 ? 0.2 : 0;

      // Type-based priority adjustment
      const typePriorityMap = {
        'HARASSMENT': 0.8,
        'FRAUD': 0.7,
        'INAPPROPRIATE_CONTENT': 0.6,
        'USER_BEHAVIOR': 0.5,
        'SPAM': 0.4,
        'OTHER': 0.3
      };

      const typeScore = typePriorityMap[type] || 0.3;

      // Calculate final priority score
      const priorityScore = (urgentMatches * 0.4) + (highMatches * 0.2) + typeScore + evidenceFactor;

      if (priorityScore >= 0.8) {
        priority = 'URGENT';
        confidence = Math.min(0.95, priorityScore);
        reasoning = 'Contains urgent keywords, high-risk type, or has evidence';
      } else if (priorityScore >= 0.6) {
        priority = 'HIGH';
        confidence = Math.min(0.85, priorityScore);
        reasoning = 'Contains high-priority keywords or serious type';
      } else if (priorityScore >= 0.4) {
        priority = 'MEDIUM';
        confidence = Math.min(0.7, priorityScore);
        reasoning = 'Standard priority based on content analysis';
      } else {
        priority = 'LOW';
        confidence = Math.min(0.6, priorityScore);
        reasoning = 'Low-priority content or insufficient indicators';
      }

      const analysis = {
        priority,
        confidence: Math.round(confidence * 100) / 100,
        reasoning,
        keywordMatches: {
          urgent: urgentMatches,
          high: highMatches
        },
        evidenceCount: evidenceUrls.length,
        typeScore,
        priorityScore: Math.round(priorityScore * 100) / 100
      };

      console.log('✅ AI: User report analysis complete:', analysis);
      return analysis;

    } catch (error) {
      console.error('❌ AI: Error analyzing user report:', error);
      return {
        priority: 'MEDIUM',
        confidence: 0.5,
        reasoning: 'Default priority due to analysis error',
        keywordMatches: { urgent: 0, high: 0 },
        evidenceCount: evidenceUrls.length,
        typeScore: 0.3,
        priorityScore: 0.5
      };
    }
  }

  // Enhanced duplicate detection with AI severity analysis
  async analyzeDuplicateSeverity({ title, description, existingReports }) {
    try {
      console.log('🤖 AI: Analyzing duplicate severity...', { title, description });

      const combinedText = `${title} ${description}`.toLowerCase();
      
      // Severity analysis based on content and context
      let severityScore = 5; // Default medium severity
      let confidence = 0.5;
      let reasoning = '';

      // Critical severity indicators
      const criticalKeywords = [
        'emergency', 'urgent', 'immediate', 'danger', 'hazard', 'accident',
        'injury', 'fire', 'flood', 'power', 'water', 'gas', 'leak'
      ];

      // High severity indicators
      const highSeverityKeywords = [
        'broken', 'damaged', 'blocked', 'overflow', 'pothole', 'traffic',
        'noise', 'pollution', 'waste', 'garbage', 'maintenance'
      ];

      // Low severity indicators
      const lowSeverityKeywords = [
        'minor', 'small', 'cosmetic', 'beauty', 'cleanup', 'improvement',
        'suggestion', 'request', 'information'
      ];

      // Count keyword matches
      const criticalMatches = criticalKeywords.filter(keyword => 
        combinedText.includes(keyword)
      ).length;
      
      const highMatches = highSeverityKeywords.filter(keyword => 
        combinedText.includes(keyword)
      ).length;

      const lowMatches = lowSeverityKeywords.filter(keyword => 
        combinedText.includes(keyword)
      ).length;

      // Calculate severity score (1-10 scale)
      let baseScore = 5;
      
      // Adjust based on keyword matches
      baseScore += (criticalMatches * 2.5); // Critical keywords add 2.5 points each
      baseScore += (highMatches * 1.5);     // High severity keywords add 1.5 points each
      baseScore -= (lowMatches * 1.0);      // Low severity keywords subtract 1 point each

      // Factor in existing reports (more reports = higher severity)
      if (existingReports && existingReports.length > 0) {
        const existingCount = existingReports.length;
        baseScore += Math.min(existingCount * 0.5, 2); // Max 2 points for multiple reports
        reasoning += `Multiple similar reports (${existingCount}) indicate recurring issue. `;
      }

      // Clamp severity score between 1 and 10
      severityScore = Math.max(1, Math.min(10, Math.round(baseScore * 10) / 10));
      
      // Calculate confidence based on keyword matches and content length
      const contentLength = combinedText.length;
      confidence = Math.min(0.95, 
        (criticalMatches * 0.3) + 
        (highMatches * 0.2) + 
        Math.min(contentLength / 200, 0.3) + 
        0.2
      );

      // Generate reasoning
      if (criticalMatches > 0) {
        reasoning += `Contains ${criticalMatches} critical keywords indicating emergency situation. `;
      }
      if (highMatches > 0) {
        reasoning += `Contains ${highMatches} high-severity keywords indicating significant issue. `;
      }
      if (lowMatches > 0) {
        reasoning += `Contains ${lowMatches} low-severity keywords suggesting minor issue. `;
      }
      
      if (reasoning === '') {
        reasoning = 'Standard severity based on content analysis';
      }

      const analysis = {
        severity: severityScore,
        confidence: Math.round(confidence * 100) / 100,
        reasoning: reasoning.trim(),
        keywordMatches: {
          critical: criticalMatches,
          high: highMatches,
          low: lowMatches
        },
        existingReportsCount: existingReports ? existingReports.length : 0,
        contentLength,
        severityLevel: severityScore >= 8 ? 'CRITICAL' : 
                      severityScore >= 6 ? 'HIGH' : 
                      severityScore >= 4 ? 'MEDIUM' : 'LOW'
      };

      console.log('✅ AI: Duplicate severity analysis complete:', analysis);
      return analysis;

    } catch (error) {
      console.error('❌ AI: Error analyzing duplicate severity:', error);
      return {
        severity: 5,
        confidence: 0.5,
        reasoning: 'Default severity due to analysis error',
        keywordMatches: { critical: 0, high: 0, low: 0 },
        existingReportsCount: 0,
        contentLength: 0,
        severityLevel: 'MEDIUM'
      };
    }
  }
}

module.exports = new AIService();
