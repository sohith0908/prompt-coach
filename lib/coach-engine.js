/**
 * Prompt Coach engine
 * - Online: Gemini (default) or Groq → JSON prompt only
 * - Offline: scored intent + channel + scenario templates
 * - Never does the user's task
 */

export const PROVIDERS = {
  gemini: {
    label: "Gemini",
    keyHint: "Free key from aistudio.google.com/apikey",
    keyPlaceholder: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey"
  },
  groq: {
    label: "Groq",
    keyHint: "Free key from console.groq.com/keys",
    keyPlaceholder: "gsk_…",
    keyUrl: "https://console.groq.com/keys"
  }
};

export const PRESETS = {
  gemini: {
    faster: {
      model: "gemini-3.5-flash-lite",
      label: "Fast",
      hint: "Default. Gemini Flash-Lite — cheap and quick.",
      thinking: "low"
    },
    balanced: {
      model: "gemini-3.8-flash",
      label: "Stronger",
      hint: "Gemini Flash — use when Fast feels thin.",
      thinking: "medium"
    }
  },
  groq: {
    faster: {
      model: "openai/gpt-oss-20b",
      label: "Fast",
      hint: "Groq GPT-OSS 20B — quick free tier.",
      thinking: null
    },
    balanced: {
      model: "openai/gpt-oss-120b",
      label: "Stronger",
      hint: "Groq GPT-OSS 120B — heavier free tier.",
      thinking: null
    }
  }
};

export function getPreset(provider, presetName) {
  const pack = PRESETS[provider] || PRESETS.gemini;
  return pack[presetName] || pack.faster;
}

export const INPUT_MAX_CHARS = 6000;

/** Compact system prompt + few-shots for faithfulness */
export const COACH_SYSTEM = `You are Prompt Coach. Output ONLY JSON. Never do the user's task (never write the email/essay/code itself).

Job: turn messy text into ONE detailed, copy-ready prompt for another AI.

## Extract slots (only if present in user words)
recipient, duration, tone, channel (email|whatsapp|linkedin|sms|chat|other), situation (cleaned one-line of THEIR facts)

## Hard rules
- Infer intent from slang/typos. Never mention spelling.
- One job only. Standalone prompt.
- ALWAYS include Known facts with a line: Situation: <cleaned user facts>
- Placeholders = only MISSING slots for THAT scenario. Never invent boss/deadline fields for landlord/heater/support/teacher.
- Never invent names, dates, metrics, credentials, employers.
- Detailed by default: role, goal, audience, tone, known facts, process, constraints, output, quality bar, fill list.
- Image → visual paragraph + "Exclude:". Ban masterpiece/8k/beautiful.
- Code → stack, I/O, edge cases, code-first; keep "don't rewrite all" if user said so.
- Homework/cheat → learning prompt, not "submit as mine".
- Mail/message: complaint | request | follow_up | apology | deadline | assignment_extension | customer_reply | lor | other — pick from evidence.
- Channel matters: WhatsApp/LinkedIn/SMS ≠ email template.
- questions: 0–2 only if a missing slot would massively improve the prompt.
- tweaks: 3 short scenario-aware chips.

## Anti-patterns (never)
- Landlord heater complaint → NO boss, NO [current deadline], NO [manager name]
- "I need support writing a blog" → writing help, NOT customer-support email
- "angry customer reply" → brand reply to customer, NOT email TO a client asking for something
- Teacher assignment extension → school context, NOT workplace deadline to manager

JSON keys:
understood (starts "You want"), corrected_request, task_type, target, assumptions[], prompt, tweaks[3], fill_hints[], questions[{id,label,placeholder}]
task_type: write|explain|code|plan|research|image|video|data|translate|other
target: chat|image|code

Few-shot intent (do NOT copy wording blindly; follow the slot rules):
User: "mail landlord heater broken 3 weeks ignore me firm not rude"
→ complaint email to landlord; Situation keeps heater/3 weeks/ignored; placeholders: landlord name, address, date reported, your name.

User: "i need support writing a blog about coffee"
→ writing/blog prompt; NOT support-desk email.

User: "angry customer reply keep brand polite"
→ customer_reply for support agent; audience = customer.`;

/** JSON schema for Gemini structured output */
export const COACH_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    understood: { type: "string" },
    corrected_request: { type: "string" },
    task_type: {
      type: "string",
      enum: [
        "write",
        "explain",
        "code",
        "plan",
        "research",
        "image",
        "video",
        "data",
        "translate",
        "other"
      ]
    },
    target: { type: "string", enum: ["chat", "image", "code"] },
    assumptions: { type: "array", items: { type: "string" } },
    prompt: { type: "string" },
    tweaks: { type: "array", items: { type: "string" } },
    fill_hints: { type: "array", items: { type: "string" } },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          placeholder: { type: "string" }
        },
        required: ["id", "label"]
      }
    }
  },
  required: ["understood", "corrected_request", "task_type", "target", "prompt", "tweaks"]
};

const STOP = new Set(
  "a an the to of for and or but in on at is are was were be been being i me my we our you your he she it they them their this that these those with from as by if so not no do does did make write want need please bro hey hi ok about just like really very also into onto".split(
    " "
  )
);

const RECIPIENTS = [
  {
    re: /\b(landlords?|landlad(?:y|ies)|property managers?)\b/i,
    id: "landlord",
    label: "landlord",
    placeholder: "[landlord name]"
  },
  {
    re: /\b(boss|manager|supervisor|team lead)\b/i,
    id: "boss",
    label: "boss / manager",
    placeholder: "[manager name]"
  },
  {
    re: /\b(teachers?|professors?|lecturers?|instructors?)\b/i,
    id: "teacher",
    label: "teacher",
    placeholder: "[teacher name]"
  },
  {
    re: /\b(customer support|support team|help ?desk|tech support|support agent)\b/i,
    id: "support",
    label: "customer support",
    placeholder: "[support contact]"
  },
  {
    re: /\b(clients?)\b/i,
    id: "client",
    label: "client",
    placeholder: "[client name]"
  },
  {
    re: /\b(hr|recruiter|hiring manager)\b/i,
    id: "hr",
    label: "HR / recruiter",
    placeholder: "[recruiter name]"
  },
  {
    re: /\b(roommate|flatmate|housemate)\b/i,
    id: "roommate",
    label: "roommate",
    placeholder: "[roommate name]"
  },
  {
    re: /\b(doctor|gp|physician|dentist)\b/i,
    id: "doctor",
    label: "doctor",
    placeholder: "[doctor name]"
  },
  {
    re: /\b(parents?|mom|dad|mother|father)\b/i,
    id: "parent",
    label: "parent",
    placeholder: "[parent name]"
  }
];

const ROLE_BY_TYPE = {
  write: "senior editor for clear, ready-to-send writing",
  explain: "expert teacher who explains with structure and examples",
  code: "senior engineer who ships the smallest correct change",
  plan: "planner who turns goals into sequenced actions",
  research: "analyst who compares options with tradeoffs",
  image: "visual director for generative-image prompts",
  video: "director for shot-ready short scripts",
  data: "data analyst who specifies question, data, and output",
  translate: "precise translator who preserves meaning and tone",
  other: "precise assistant who follows a detailed brief"
};

const CHANNEL_PATTERNS = [
  { id: "whatsapp", re: /\b(whats?app|wa message|text (him|her|them)|sms|iMessage)\b/i },
  { id: "linkedin", re: /\b(linkedin|linked ?in)\b/i },
  { id: "email", re: /\b(e-?mail|mail|letter)\b/i },
  { id: "sms", re: /\b(text message|short text|sms)\b/i },
  { id: "chat", re: /\b(slack|discord|dm|direct message|chat message)\b/i }
];

function scoreTask(text) {
  const scores = {
    image: 0,
    homework: 0,
    code: 0,
    resume: 0,
    mail: 0,
    video: 0,
    plan: 0,
    research: 0,
    write: 0,
    explain: 0,
    data: 0,
    translate: 0,
    customer_reply: 0,
    lor: 0
  };

  const bump = (k, n = 1) => {
    scores[k] += n;
  };

  if (/\b(image|picture|photo|poster|logo|icon|draw|illustration|midjourney|dall.?e|flux|imagen)\b/i.test(text)) {
    bump("image", 4);
  }
  if (/\b(homework|do my (essay|hw|assignment)|write my essay for (me|class)|answers for (test|quiz)|assignment answers)\b/i.test(text)) {
    bump("homework", 5);
  }
  if (/\b(code|function|api|debug|typescript|javascript|python|react|sql|bug|usestate|compile)\b/i.test(text)) {
    bump("code", 4);
  }
  if (/\b(resume|cv)\b/i.test(text)) bump("resume", 5);
  if (/\b(e-?mail|mail|letter)\b/i.test(text)) bump("mail", 4);
  if (/\b(recommendation letter|letter of recommendation|\blor\b)\b/i.test(text)) {
    bump("lor", 6);
    bump("mail", 2);
  }
  if (/\b((reply|respond) (to )?(an? )?angry customer|customer reply|brand (reply|response)|support reply)\b/i.test(text)) {
    bump("customer_reply", 6);
  } else if (/\bangry customer\b/i.test(text) && /\b(reply|respond|response)\b/i.test(text)) {
    bump("customer_reply", 6);
  }
  // Caption + reel/youtube → prefer video over generic write
  if (/\b(video|reel|youtube|short script|tiktok)\b/i.test(text)) bump("video", 4);
  if (/\b(caption)\b/i.test(text) && /\b(reel|tiktok|instagram|ig|youtube|short)\b/i.test(text)) {
    bump("video", 3);
    bump("write", 1);
  } else if (/\b(caption)\b/i.test(text)) {
    bump("write", 3);
  }
  if (/\b(plan|roadmap|steps|strategy|timeline|itinerary|budget travel)\b/i.test(text)) {
    bump("plan", 3);
  }
  if (/\b(research|compare|analyze|analyse|summar)/i.test(text)) bump("research", 3);
  if (/\b(essay|blog|rewrite|linkedin post|cover letter|apology|apologize)\b/i.test(text)) {
    bump("write", 3);
  }
  if (/\b(explain|teach|what is|how does)\b/i.test(text)) bump("explain", 3);
  if (/\b(chart|csv|excel|spreadsheet|dataset)\b/i.test(text)) bump("data", 4);
  if (/\b(translate|translation|in hindi|in spanish|to hindi|to tamil|to french)\b/i.test(text)) {
    bump("translate", 5);
  }
  if (/\b(write|draft)\b/i.test(text) && !scores.mail && !scores.code) bump("write", 1);

  let best = "other";
  let bestScore = 0;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestScore) {
      best = k;
      bestScore = v;
    }
  }
  return { best, scores, bestScore };
}

function detectChannel(text, mailLike) {
  for (const c of CHANNEL_PATTERNS) {
    if (c.re.test(text)) return c.id;
  }
  if (mailLike) return "email";
  return "other";
}

function detectRecipient(text, scores) {
  // Do NOT treat bare "support" / "customer" as recipients
  if (scores.customer_reply >= 5) {
    return {
      id: "customer",
      label: "customer",
      placeholder: "[customer name]",
      re: null
    };
  }
  // "need support writing" is not customer support
  if (/\b(need|want|get)\s+support\s+(with|writing|on|for)\b/i.test(text)) {
    return null;
  }
  for (const r of RECIPIENTS) {
    if (r.re.test(text)) return r;
  }
  // "customers" only as recipient if clearly writing TO them (not brand reply)
  if (/\b(to|for)\s+(a\s+)?(customer|customers)\b/i.test(text) && scores.customer_reply < 5) {
    return { id: "client", label: "customer", placeholder: "[customer name]", re: null };
  }
  return null;
}

function extractDuration(text) {
  const m = text.match(/\b(\d+)\s*(days?|weeks?|months?|years?|hours?|mins?|minutes?)\b/i);
  if (m) return `${m[1]} ${m[2].toLowerCase()}`;
  if (/\bsince\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|last\s+\w+)\b/i.test(text)) {
    const s = text.match(/\bsince\s+([^.!?]+)/i);
    return s ? `since ${s[1].trim().split(/\s+/).slice(0, 4).join(" ")}` : "";
  }
  return "";
}

function extractLengthConstraint(text) {
  const words = text.match(/\b(\d+)\s*words?\b/i);
  if (words) return `${words[1]} words`;
  const secs = text.match(/\b(under|within)?\s*(\d+)\s*(sec|secs|seconds|s)\b/i);
  if (secs) return `${secs[2]} seconds`;
  const days = text.match(/\b(\d+)\s*days?\b/i);
  if (days && /\b(travel|trip|itinerary|budget)\b/i.test(text)) return `${days[1]} days`;
  return "";
}

function tidy(raw) {
  let text = String(raw || "").replace(/\s+/g, " ").trim();
  text = text.replace(/^(hey|hi|hello|bro|pls|please|ok|so)\b[,!\s]*/i, "");
  text = text.replace(
    /\b(i want an ai to|i want ai to|i want you to|i wanna|i want to|i want|i need you to|i need to|i need|can you|could you|please)\b/gi,
    " "
  );
  text = text.replace(
    /\b(make the ai|make ai|tell the ai|tell ai|ask gpt to|ask chatgpt to|use ai to)\b/gi,
    " "
  );
  text = text.replace(/^(ai|gpt|chatgpt)\b\s*/i, "");
  text = text.replace(/\s+/g, " ").trim().replace(/^(to|a|an|the)\s+/i, "");
  if (!text) text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Cleaned situation line that keeps the user's distinctive facts */
export function situationLine(raw) {
  let s = String(raw || "").replace(/\s+/g, " ").trim();
  s = s
    .replace(/\b(make the ai|make ai|tell the ai|ask gpt to|ask chatgpt to|use ai to|i want ai to|i want an ai to)\b/gi, "")
    .replace(/\b(i need|i want)\b/gi, "")
    .replace(/\b(write|draft)\s+(an?\s+)?(e-?mail|mail|letter)\s+(to\s+)?/gi, "")
    .replace(/^(e-?mail|mail|letter)\s+(to\s+)?/i, "")
    .replace(/\bmake\s+(resume|cv)\b/gi, "$1")
    .replace(/\b(he|she|they)\s+ignore(?:s|d)?\s+me\b/gi, "they have been ignoring requests")
    .replace(/\bignores?\b/gi, "ignoring")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,.\-\s]+/, "");
  if (!s) s = String(raw || "").replace(/\s+/g, " ").trim();

  const dur = s.match(/\b(\d+)\s*(days?|weeks?|months?|years?)\b/i);
  const problem = s.match(
    /\b(heater|ac|a\/c|wifi|water|power|internet|plumbing|fridge|oven|door|window|leak|refund|shipment|assignment)\b/i
  );
  const recip = RECIPIENTS.find((r) => r.re.test(s));
  if (problem && dur && recip) {
    const ignored = /\b(ignor|no response|not respond|ghost|still waiting)/i.test(s);
    return `${problem[0]} issue for ${dur[1]} ${dur[2]}${ignored ? `; ${recip.label} has not responded to earlier requests` : ""}`;
  }
  return s.replace(/[.?!]+$/, "");
}

export function extractSlots(raw) {
  const text = String(raw || "");
  const { best, scores, bestScore } = scoreTask(text);
  const recipient = detectRecipient(text, scores);
  const duration = extractDuration(text);
  const lengthConstraint = extractLengthConstraint(text);

  const tone = {
    firm: /\bfirm\b/i.test(text),
    polite: /\bpolite\b/i.test(text),
    angry: /\b(angry|mad|furious|pissed)\b/i.test(text),
    formal: /\b(formal|professional)\b/i.test(text),
    notRude: /\bnot\s+rude\b/i.test(text) || /\bwithout\s+(being\s+)?rude\b/i.test(text),
    notAngry: /\bnot\s+angry\b/i.test(text) || /\bwithout\s+(being\s+)?angry\b/i.test(text),
    keepBrand: /\b(brand|keep\s+(it\s+)?polite|professional tone)\b/i.test(text)
  };

  const isMailWord = /\b(e-?mail|mail|letter)\b/i.test(text);
  const isResume = best === "resume" || /\b(resume|cv)\b/i.test(text);
  const isApology = /\b(apolog(?:y|ise|ize)|sorry)\b/i.test(text);
  const isFollowUp = /\b(follow[- ]?up|following up|still waiting|no response|ignored|ignor)/i.test(text);
  const isDeadlineWord = /\b(deadline|due date|more time)\b/i.test(text);
  const isAssignmentExt =
    /\b(extension|extend|more time)\b/i.test(text) &&
    (recipient?.id === "teacher" || /\b(assignment|homework|project|essay|class)\b/i.test(text));
  const isWorkplaceDeadline =
    isDeadlineWord &&
    (recipient?.id === "boss" || (!recipient && !isAssignmentExt && /\b(deadline|due date)\b/i.test(text)));

  const isComplaint =
    (isMailWord || recipient?.id === "landlord") &&
    (/\b(broken|complaint|issue|problem|not work|doesn't work|leak|ignore|no response|repair|fix|refund)\b/i.test(
      text
    ) ||
      recipient?.id === "landlord");

  const channel = detectChannel(
    text,
    isMailWord || best === "mail" || best === "lor" || (recipient && best !== "customer_reply")
  );

  let mailScenario = "";
  const messageLike =
    isMailWord ||
    channel === "email" ||
    channel === "whatsapp" ||
    channel === "sms" ||
    channel === "chat" ||
    best === "mail" ||
    best === "lor" ||
    best === "customer_reply" ||
    (recipient && (isMailWord || channel !== "other"));

  if (best === "customer_reply") {
    mailScenario = "customer_reply";
  } else if (best === "lor" || /\brecommendation letter|letter of recommendation|\blor\b/i.test(text)) {
    mailScenario = "lor";
  } else if (messageLike || (recipient && isMailWord)) {
    if (isAssignmentExt) mailScenario = "assignment_extension";
    else if (isApology && !isComplaint) mailScenario = "apology";
    else if (isWorkplaceDeadline) mailScenario = "deadline";
    else if (
      isComplaint &&
      (recipient?.id === "landlord" ||
        /\b(broken|leak|heater|repair|doesn't work|not work)\b/i.test(text))
    ) {
      // Concrete defect / landlord problem = complaint (even if also "ignored me")
      mailScenario = "complaint";
    } else if (isFollowUp) {
      // Chase / still-waiting (refund, ticket) beats soft "issue" wording
      mailScenario = "follow_up";
    } else if (isComplaint) mailScenario = "complaint";
    else if (isMailWord || channel === "email" || channel === "whatsapp" || recipient) {
      // Recipient alone without message channel → only if clearly messaging
      if (isMailWord || channel !== "other" || best === "mail") mailScenario = "request";
      else if (recipient && /\b(tell|ask|message|text|say to)\b/i.test(text)) mailScenario = "request";
    }
  }

  // Roommate + whatsapp without "mail" still gets request via channel
  if (!mailScenario && recipient && (channel === "whatsapp" || channel === "sms" || channel === "chat")) {
    mailScenario = isComplaint ? "complaint" : "request";
  }

  const contentWords = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

  const distinctive = [...new Set(contentWords)].filter(
    (w) =>
      ![
        "write",
        "mail",
        "email",
        "letter",
        "make",
        "want",
        "need",
        "firm",
        "rude",
        "polite",
        "support",
        "draft"
      ].includes(w)
  );

  let confidence = 0.3;
  if (recipient) confidence += 0.15;
  if (duration) confidence += 0.1;
  if (mailScenario) confidence += 0.15;
  if (bestScore >= 3) confidence += 0.15;
  if (distinctive.length >= 2) confidence += 0.1;
  if (tone.firm || tone.polite || tone.notRude) confidence += 0.05;
  if (channel !== "other") confidence += 0.05;
  confidence = Math.min(1, confidence);

  let taskType = "other";
  let target = "chat";
  if (best === "image") {
    taskType = "image";
    target = "image";
  } else if (best === "code") {
    taskType = "code";
    target = "code";
  } else if (best === "homework") {
    taskType = "explain";
  } else if (best === "resume" || best === "mail" || best === "write" || best === "lor" || best === "customer_reply") {
    taskType = "write";
  } else if (best === "video") {
    taskType = "video";
  } else if (best === "plan") {
    taskType = "plan";
  } else if (best === "research") {
    taskType = "research";
  } else if (best === "explain") {
    taskType = "explain";
  } else if (best === "data") {
    taskType = "data";
  } else if (best === "translate") {
    taskType = "translate";
  }

  return {
    recipient,
    duration,
    lengthConstraint,
    tone,
    situation: situationLine(text),
    isMail: Boolean(mailScenario) && channel === "email",
    isResume,
    mailScenario,
    channel: mailScenario && channel === "other" ? "email" : channel,
    distinctive,
    confidence,
    intent: best,
    intentScores: scores,
    taskType,
    target,
    raw: text
  };
}

function tonePhrase(slots, formalTweak) {
  const bits = [];
  if (slots.tone.firm) bits.push("firm");
  if (slots.tone.polite) bits.push("polite");
  if (slots.tone.angry && !slots.tone.notAngry && slots.mailScenario !== "customer_reply") {
    bits.push("direct about frustration");
  }
  if (slots.tone.notRude) bits.push("not rude");
  if (slots.tone.notAngry) bits.push("not angry");
  if (slots.tone.keepBrand) bits.push("on-brand and calm");
  if (formalTweak || slots.tone.formal) bits.push("formal");
  if (!bits.length) return "clear, human, and professional";
  if (slots.tone.firm && slots.tone.notRude) return "firm, not rude";
  return bits.join(", ");
}

function detectTool(text) {
  const s = text.toLowerCase();
  if (/midjourney|\bmj\b/.test(s)) return "midjourney";
  if (/flux|stable diffusion|sdxl/.test(s)) return "flux";
  if (/ideogram/.test(s)) return "ideogram";
  if (/claude/.test(s)) return "claude";
  return "general";
}

function aspectFlag(text) {
  const s = text.toLowerCase();
  if (/portrait|vertical|story|reel|tiktok/.test(s)) return "--ar 2:3";
  if (/landscape|wide|banner|cinematic/.test(s)) return "--ar 16:9";
  if (/square|icon|avatar|logo/.test(s)) return "--ar 1:1";
  return "";
}

function applyShape(type, target, shape) {
  if (shape === "image") return { type: "image", target: "image" };
  if (shape === "code") return { type: "code", target: "code" };
  if (shape === "chat") {
    return { type: type === "image" || type === "code" ? "write" : type, target: "chat" };
  }
  return { type, target };
}

function withoutToolNames(text) {
  return text
    .replace(/\b(midjourney|claude|flux|stable diffusion|sdxl|ideogram|chatgpt|gemini|dall-?e|groq|imagen)\b/gi, "")
    .replace(/\s+,/g, "")
    .replace(/,\s*,/g, ", ")
    .replace(/,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isHomework(text) {
  return /\b(homework|do my (essay|hw|assignment)|write my essay for (me|class)|answers for (test|quiz)|assignment answers)\b/i.test(
    text
  );
}

function channelLabel(channel) {
  if (channel === "whatsapp") return "WhatsApp message";
  if (channel === "linkedin") return "LinkedIn message/post";
  if (channel === "sms") return "SMS / text message";
  if (channel === "chat") return "chat message";
  if (channel === "email") return "email";
  return "message";
}

function placeholdersFor(slots, kind) {
  if (kind === "homework") {
    return [
      "[topic details] = what the assignment asks",
      "[level] = class level",
      "[what I tried] = what you already attempted"
    ];
  }
  if (kind === "code") {
    return [
      "[language/stack] = tools you use",
      "[input] = what goes in",
      "[output] = what must come out",
      "[repro] = minimal steps to reproduce (if a bug)"
    ];
  }
  if (kind === "image") {
    return [
      "[medium] = photo / illustration / 3D",
      "[lighting] = source + direction",
      "[palette] = 2–3 colors"
    ];
  }
  if (kind === "resume") {
    return [
      "[paste bullets] = current bullets",
      "[target role] = role you want",
      "[years] = years of experience"
    ];
  }
  if (kind === "video") {
    return [
      "[duration] = target length",
      "[audience] = who watches",
      "[cta] = end call-to-action if any"
    ];
  }
  if (kind === "translate") {
    return [
      "[source language] = language of the original",
      "[target language] = language to translate into",
      "[paste text] = text to translate"
    ];
  }
  if (kind === "plan" || kind === "travel") {
    return [
      "[budget] = money limit if any",
      "[constraints] = must-haves / avoid",
      "[start date] = when this starts"
    ];
  }
  if (kind === "research") {
    return ["[paste material] = article or notes if you have them", "[decision] = what you need to decide"];
  }
  if (kind === "data") {
    return ["[paste sample rows] = example data", "[chart type] = bar / line / pie if known"];
  }
  if (kind === "customer_reply") {
    return [
      "[customer name] = if known",
      "[order or ticket id] = if relevant",
      "[what you can offer] = refund / replace / next step you can actually do",
      "[your name] = agent sign-off"
    ];
  }
  if (kind === "lor") {
    return [
      slots.recipient?.placeholder || "[recommender name]",
      "[student or candidate name]",
      "[program or role]",
      "[2–3 strengths with evidence]",
      "[your relationship] = how you know them"
    ];
  }
  if (kind === "assignment_extension") {
    return [
      slots.recipient?.placeholder || "[teacher name]",
      "[assignment name]",
      "[current due date]",
      "[requested date]",
      "[honest reason]",
      "[your name]"
    ];
  }
  if (kind === "complaint" && slots.recipient?.id === "landlord") {
    return [
      "[landlord name] = landlord or property manager name",
      "[property address] = unit / building address",
      "[date first reported] = when you first reported it",
      "[your name] = how you sign off"
    ];
  }
  if (kind === "complaint") {
    const who = slots.recipient?.placeholder || "[recipient name]";
    return [
      `${who} = who you are writing to`,
      "[date first reported] = when the issue started or was reported",
      "[your name] = how you sign off"
    ];
  }
  if (kind === "deadline") {
    return [
      "[manager name] = boss or manager name",
      "[current deadline] = current due date",
      "[requested date] = new date if asking to move it",
      "[reason] = one honest reason",
      "[your name] = sign-off"
    ];
  }
  if (kind === "apology") {
    return [
      slots.recipient?.placeholder || "[recipient name]",
      "[meeting or event] = what you missed",
      "[your name] = sign-off"
    ];
  }
  if (kind === "follow_up" || kind === "request") {
    const fills = [
      slots.recipient?.placeholder || "[recipient name]",
      "[extra detail] = any fact still missing",
      "[your name] = sign-off"
    ];
    if (slots.channel === "whatsapp" || slots.channel === "sms") {
      return fills.filter((x) => !/your name/i.test(x)).concat(["[your name] = optional sign-off"]);
    }
    return fills;
  }
  if (kind === "linkedin" || kind === "caption") {
    return ["[audience] = who should care", "[one proof point] = fact or result you can stand behind"];
  }
  return ["[audience] = who this is for", "[extra facts] = missing details"];
}

function forbiddenTokensFor(slots) {
  const bad = [];
  const userHasDeadline = /\b(deadline|due date|extension|more time)\b/i.test(slots.raw);
  const userHasBoss = /\b(boss|manager|supervisor)\b/i.test(slots.raw);
  const school = slots.mailScenario === "assignment_extension" || slots.recipient?.id === "teacher";

  if (!userHasDeadline || school) {
    if (slots.mailScenario !== "deadline" && slots.mailScenario !== "assignment_extension") {
      bad.push("[current deadline]", "[requested date]", "about a deadline");
    }
  }
  if (slots.mailScenario === "assignment_extension") {
    bad.push("[manager name]", "my boss", "workplace");
  }
  if (!userHasBoss && slots.mailScenario !== "deadline") {
    bad.push("my boss");
  }
  if (slots.recipient?.id === "landlord" || slots.mailScenario === "complaint") {
    if (!userHasBoss) bad.push("[manager name]", "my boss");
    if (slots.mailScenario !== "deadline") bad.push("[current deadline]", "[requested date]");
  }
  if (slots.mailScenario === "customer_reply") {
    bad.push("[manager name]", "[current deadline]", "my boss", "landlord");
  }
  if (slots.intent === "write" && !slots.mailScenario && /\bsupport writing\b/i.test(slots.raw)) {
    bad.push("customer support", "[support contact]", "ticket");
  }
  return [...new Set(bad)];
}

function requiredTokensFor(slots) {
  const need = [];
  if (slots.recipient) {
    if (slots.recipient.id === "landlord") need.push("landlord");
    else if (slots.recipient.id === "boss") need.push("boss", "manager");
    else if (slots.recipient.id === "customer") need.push("customer");
    else need.push(slots.recipient.label.split(" ")[0]);
  }
  for (const w of slots.distinctive.slice(0, 8)) {
    if (w.length > 2) need.push(w);
  }
  const sit = `${slots.situation} ${slots.raw}`.toLowerCase();
  for (const w of [
    "heater",
    "landlord",
    "broken",
    "weeks",
    "deadline",
    "resume",
    "python",
    "sql",
    "refund",
    "react",
    "library",
    "translate",
    "whatsapp"
  ]) {
    if (sit.includes(w)) need.push(w);
  }
  return [...new Set(need)];
}

function buildMessageGoal(slots) {
  const who = slots.recipient
    ? slots.recipient.id === "customer"
      ? "the customer"
      : `my ${slots.recipient.label}`
    : "[recipient]";
  const tone = tonePhrase(slots, false);
  const medium = channelLabel(slots.channel);

  if (slots.mailScenario === "customer_reply") {
    return `Write a short ${medium === "email" ? "support email" : "support reply"} to an upset customer. Tone: ${tone}. Stay on-brand, acknowledge the issue, and offer one clear next step. Keep unknowns as [placeholders].`;
  }
  if (slots.mailScenario === "lor") {
    return `Write a recommendation letter for the candidate. Tone: ${tone}. Use only strengths the user provides; never invent achievements. Keep unknowns as [placeholders].`;
  }
  if (slots.mailScenario === "assignment_extension") {
    return `Write a short ${medium} to ${who} asking for an assignment extension. Tone: ${tone}. School context — not a workplace deadline to a manager. Keep unknowns as [placeholders].`;
  }
  if (slots.mailScenario === "complaint") {
    return `Write a short ${medium} to ${who} about this problem. Tone: ${tone}. Ask for a clear next step and timeline. Keep unknowns as [placeholders].`;
  }
  if (slots.mailScenario === "deadline") {
    return `Write a short ${medium} to ${who} about a deadline that needs to move or stay firm. Tone: ${tone}. Keep unknowns as [placeholders].`;
  }
  if (slots.mailScenario === "apology") {
    return `Write a short apology ${medium} to ${who}. Tone: ${tone}. Keep unknowns as [placeholders].`;
  }
  if (slots.mailScenario === "follow_up") {
    return `Write a short follow-up ${medium} to ${who}. Tone: ${tone}. Reference the open issue and ask for a response. Keep unknowns as [placeholders].`;
  }
  return `Write a short ${medium} to ${who}. Tone: ${tone}. Keep unknowns as [placeholders]. Keep it natural for ${medium}.`;
}

function buildImagePrompt(clean, tool, source) {
  const subject = withoutToolNames(clean).replace(/[.?!]$/, "");
  const exclude =
    "Exclude: text overlays, watermarks, logos, extra limbs, distorted hands/faces, clutter, muddy colors, masterpiece, 8k, beautiful.";
  const ar = aspectFlag(source);
  if (tool === "midjourney") {
    return `${subject}, [medium], soft directional light, [framing], muted [palette], quiet mood${ar ? " " + ar : ""}\n${exclude}`;
  }
  return [
    `${subject}. Medium: [photo / illustration / 3D]. Time: [time of day]. Light: [source + direction + soft/hard]. Framing: [close / medium / wide], eye-level unless specified. Palette: [2–3 colors]. Mood: [one word]. Texture: [surface that matters]. Background: simple so the subject stays primary.${ar ? ` Aspect: ${ar.replace("--ar ", "")}.` : ""}`,
    exclude
  ].join("\n");
}

function processFor(kind) {
  if (kind === "code") {
    return [
      "Restate the goal in one line.",
      "List assumptions.",
      "Implement the smallest correct change (do not rewrite unrelated code).",
      "Note one edge case and how you handled it.",
      "Give a short how-to-run note."
    ];
  }
  if (
    ["complaint", "follow_up", "request", "deadline", "apology", "assignment_extension", "customer_reply", "lor"].includes(
      kind
    )
  ) {
    return [
      "Open with the purpose in one line.",
      "State the facts from Known facts only.",
      "Ask for one clear action (and a timeline if relevant).",
      "Close appropriately for the channel; use name placeholder if needed."
    ];
  }
  if (kind === "resume") {
    return [
      "Rewrite bullets as outcomes.",
      "Keep only tools the user actually named.",
      "Do not invent employers, dates, or metrics."
    ];
  }
  if (kind === "homework") {
    return [
      "Ask what I already understand if needed.",
      "Teach the method in steps.",
      "Give a short practice check — not a finished submission."
    ];
  }
  if (kind === "video") {
    return [
      "Hook in the first line.",
      "Beat-by-beat script with timing.",
      "On-screen text suggestions.",
      "End with one CTA."
    ];
  }
  if (kind === "translate") {
    return [
      "Detect or confirm source language.",
      "Translate meaning, not word-for-word fluff.",
      "Keep tone; flag idioms that do not carry over."
    ];
  }
  if (kind === "plan" || kind === "travel") {
    return [
      "Clarify constraints from Known facts.",
      "Day-by-day or step-by-step plan.",
      "Budget/time notes.",
      "One backup option."
    ];
  }
  if (kind === "research") {
    return [
      "Frame the decision.",
      "Compare options with tradeoffs.",
      "Cite uncertainty; do not invent sources.",
      "End with a clear recommendation if evidence allows."
    ];
  }
  if (kind === "data") {
    return [
      "State the question.",
      "Specify required columns / fields.",
      "Propose chart or table layout.",
      "Do not invent numbers."
    ];
  }
  if (kind === "explain") {
    return ["Start from what I likely know.", "Explain in layered depth.", "Give one concrete example."];
  }
  return ["Lead with the result.", "Support with minimum needed detail.", "Use short headings only when they help."];
}

function formatFor(kind) {
  if (kind === "code") {
    return [
      "Assumptions as bullets.",
      "One fenced code block with language tag.",
      "Then: How to run / One edge case / What stayed unchanged."
    ];
  }
  if (kind === "homework") {
    return [
      "Teaching steps.",
      "One worked mini-example.",
      "A practice question for me (do not fully solve it)."
    ];
  }
  if (kind === "video") {
    return ["Hook", "Timed beats", "On-screen text", "CTA"];
  }
  if (kind === "image") {
    return ["Single visual paragraph ready to paste.", "Exclude line."];
  }
  return ["The draft ready to copy.", "No extra invented sections."];
}

function looksLikeFinishedWork(prompt) {
  const p = String(prompt || "");
  if (/^Subject:\s*/im.test(p) && /Dear\s+/i.test(p)) return true;
  if (/(Sincerely|Best regards|Yours truly),?\s*$/im.test(p) && p.split(/\n/).length < 40) {
    if (!/## Goal|You are a |<role>/i.test(p)) return true;
  }
  return false;
}

function buildPromptFromSlots({
  role,
  goal,
  slots,
  kind,
  shorter,
  formal,
  tool,
  answers,
  placeholders
}) {
  const tone = tonePhrase(slots, formal);
  const length = shorter
    ? "Keep the whole answer under 180 words."
    : slots.lengthConstraint
      ? `Honor length constraint: ${slots.lengthConstraint}.`
      : "Complete enough for first-try use. Structure over fluff.";

  const answerLines = Object.entries(answers || {})
    .filter(([, v]) => String(v || "").trim())
    .map(([k, v]) => `- ${k}: ${String(v).trim()}`);

  const known = [`- Situation: ${slots.situation}`];
  if (slots.recipient) known.push(`- Recipient role: ${slots.recipient.label}`);
  if (slots.channel && slots.channel !== "other") known.push(`- Channel: ${channelLabel(slots.channel)}`);
  if (slots.duration) known.push(`- Duration mentioned: ${slots.duration}`);
  if (slots.lengthConstraint) known.push(`- Length / time constraint: ${slots.lengthConstraint}`);
  if (slots.tone.firm || slots.tone.notRude || slots.tone.polite || slots.tone.keepBrand) {
    known.push(`- Requested tone: ${tone}`);
  }
  known.push("- Do not invent names, dates, metrics, employers, or credentials.");
  known.push("- Output a prompt/brief only — do not produce the finished deliverable in your reply to this coach.");

  const process = processFor(kind);
  const format = formatFor(kind);
  const quality = [
    "Uses only Known facts; unknowns stay as the listed placeholders.",
    `Matches tone: ${tone}.`,
    "Does not invent people, dates, or a second unrelated request.",
    "Does not write the finished email/essay/code as if the task is already done — write instructions for another AI."
  ];

  const fill = placeholders.map((p) => `- ${p}`);

  if (tool === "claude") {
    return [
      `<role>\nYou are a ${role}.\n</role>`,
      `<task>\n${goal}\n</task>`,
      answerLines.length ? `<user_answers>\n${answerLines.join("\n")}\n</user_answers>` : "",
      `<known_facts>\n${known.join("\n")}\n</known_facts>`,
      `<process>\n${process.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n</process>`,
      `<constraints>\n- Tone: ${tone}\n- ${length}\n</constraints>`,
      `<output>\n${format.map((f) => `- ${f}`).join("\n")}\n</output>`,
      `<quality>\n${quality.map((q) => `- ${q}`).join("\n")}\n</quality>`,
      `<fill_these>\n${fill.join("\n")}\n</fill_these>`
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    `You are a ${role}.`,
    "",
    "## Goal",
    goal,
    "",
    ...(answerLines.length ? ["## Answers from user", ...answerLines, ""] : []),
    "## Audience & tone",
    `- Audience: ${slots.recipient ? slots.recipient.label : "[audience]"}`,
    `- Tone: ${tone}`,
    ...(slots.channel && slots.channel !== "other" ? [`- Channel: ${channelLabel(slots.channel)}`] : []),
    "",
    "## Known facts",
    ...known,
    "",
    "## Process",
    ...process.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## Constraints",
    `- ${length}`,
    "- Prefer concrete wording over vague praise.",
    "- Missing facts stay as the placeholders listed below.",
    "- Do not add a second unrelated task.",
    "- Do not produce the finished deliverable; produce instructions another AI will follow.",
    "",
    "## Output format",
    ...format.map((f) => `- ${f}`),
    "",
    "## Quality bar",
    ...quality.map((q) => `- ${q}`),
    "",
    "## Fill these placeholders before sending",
    ...fill
  ].join("\n");
}

function questionsFor(slots, kind, answers) {
  const answered = answers || {};
  const qs = [];
  if (kind === "complaint" && slots.recipient?.id === "landlord") {
    if (!answered.date_reported) {
      qs.push({
        id: "date_reported",
        label: "When did you first report the problem?",
        placeholder: "e.g. 12 September"
      });
    }
    if (!answered.address) {
      qs.push({
        id: "address",
        label: "Property address or unit?",
        placeholder: "e.g. Flat 2B, 14 Oak Street"
      });
    }
  } else if (kind === "deadline" || kind === "assignment_extension") {
    if (!answered.reason) {
      qs.push({
        id: "reason",
        label: kind === "assignment_extension" ? "Why do you need the extension?" : "Why does the deadline need to change?",
        placeholder: "e.g. waiting on final data"
      });
    }
  } else if (kind === "customer_reply" && !answered.offer) {
    qs.push({
      id: "offer",
      label: "What can you actually offer the customer?",
      placeholder: "e.g. full refund within 3 days"
    });
  } else if (kind === "resume" && !answered.target_role) {
    qs.push({
      id: "target_role",
      label: "What job title are you aiming for?",
      placeholder: "e.g. junior data analyst"
    });
  } else if (kind === "code" && !answered.stack && !/\b(python|javascript|typescript|react|sql|java|go|rust)\b/i.test(slots.raw)) {
    qs.push({
      id: "stack",
      label: "Which language or stack?",
      placeholder: "e.g. Python 3.12"
    });
  } else if (kind === "translate" && !answered.target_lang) {
    qs.push({
      id: "target_lang",
      label: "Translate into which language?",
      placeholder: "e.g. Hindi"
    });
  }
  return qs.slice(0, 2);
}

function tweakLabels({ shorter, formal, target, kind, slots }) {
  const tweaks = [];
  if (!shorter) tweaks.push("Make it shorter");
  else tweaks.push("Make it more detailed");

  if (kind === "complaint" || kind === "follow_up") tweaks.push("Ask for a clearer timeline");
  else if (kind === "customer_reply") tweaks.push("More empathetic");
  else if (kind === "code") tweaks.push("Stricter: minimal diff only");
  else if (kind === "resume") tweaks.push("More metrics-focused");
  else if (kind === "video") tweaks.push("Stronger hook");
  else if (target !== "image") tweaks.push("Switch to an image prompt");
  else tweaks.push("Make it a chat prompt");

  if (!formal && slots.channel !== "whatsapp") tweaks.push("More formal");
  else if (slots.channel === "whatsapp") tweaks.push("More casual");
  else tweaks.push("More direct");

  return tweaks.slice(0, 3);
}

function enrichWithAnswers(slots, answers) {
  const next = { ...slots, situation: slots.situation };
  if (answers.date_reported) next.situation += `; first reported on ${answers.date_reported}`;
  if (answers.address) next.situation += `; property: ${answers.address}`;
  if (answers.reason) next.situation += `; reason: ${answers.reason}`;
  if (answers.target_role) next.situation += `; target role: ${answers.target_role}`;
  if (answers.stack) next.situation += `; stack: ${answers.stack}`;
  if (answers.offer) next.situation += `; can offer: ${answers.offer}`;
  if (answers.target_lang) next.situation += `; translate to: ${answers.target_lang}`;
  if (answers.medium) next.situation += `; medium: ${answers.medium}`;
  return next;
}

function resolveKind(slots, type, target, input) {
  if (isHomework(input)) return "homework";
  if (target === "image" || type === "image") return "image";
  if (type === "code" || target === "code") return "code";
  if (slots.isResume) return "resume";
  if (slots.mailScenario) return slots.mailScenario;
  if (type === "video" || slots.intent === "video") return "video";
  if (type === "translate" || slots.intent === "translate") return "translate";
  if (type === "plan" || /\b(travel|itinerary|budget travel)\b/i.test(input)) {
    return /\b(travel|itinerary|japan|trip)\b/i.test(input) ? "travel" : "plan";
  }
  if (type === "research") return "research";
  if (type === "data") return "data";
  if (type === "explain") return "explain";
  if (/\blinkedin\b/i.test(input)) return "linkedin";
  if (/\bcaption\b/i.test(input) && type === "write") return "caption";
  return type === "write" ? "write" : "other";
}

function buildGoal(kind, slots, input, type) {
  if (kind === "homework") {
    return "Help me learn this topic by guiding me through the reasoning. Do not hand me a finished submission I can turn in as my own.";
  }
  if (kind === "code") {
    const minimal = /\b(dont|don't|do not)\s+rewrite\b/i.test(input);
    return `Implement only this: ${tidy(input).replace(/[.?!]$/, "")}.${minimal ? " Change as little as possible; do not rewrite unrelated code." : ""}`;
  }
  if (kind === "resume") {
    const data = /\b(data|python|sql|analyst)\b/i.test(input);
    const fe = /\b(frontend|react|ui|css)\b/i.test(input);
    if (data) {
      return "Rewrite resume bullets for a data role. Use Python/SQL only where the user actually has them. Never invent employers, dates, or metrics. User pastes old bullets at [paste bullets].";
    }
    if (fe) {
      return "Rewrite resume bullets for a frontend role. Keep only frameworks the user named. Never invent employers, dates, or metrics. User pastes old bullets at [paste bullets].";
    }
    return "Rewrite resume bullets as outcomes. Never invent experience, tools, or numbers. User pastes old bullets at [paste bullets].";
  }
  if (slots.mailScenario) return buildMessageGoal(slots);
  if (kind === "video") {
    return `Create a short-form video script for: ${slots.situation}.${slots.lengthConstraint ? ` Target length: ${slots.lengthConstraint}.` : ""}`;
  }
  if (kind === "translate") {
    return `Translate the user's text accurately while preserving tone. Situation: ${slots.situation}.`;
  }
  if (kind === "travel") {
    return `Build a practical travel plan for: ${slots.situation}.`;
  }
  if (kind === "plan") return `Build a practical plan for: ${slots.situation}.`;
  if (kind === "explain") return `Explain clearly: ${slots.situation}.`;
  if (kind === "research") return `Research and compare options for: ${slots.situation}.`;
  if (kind === "data") return `Specify analysis/chart work for: ${slots.situation}.`;
  if (kind === "linkedin") return `Write a LinkedIn post about: ${slots.situation}. Keep it specific; no fake metrics.`;
  if (kind === "caption") return `Write a social caption for: ${slots.situation}.`;
  if (kind === "write") return `Write this: ${slots.situation}.`;
  return `Do this: ${slots.situation}.`;
}

/** Validate prompt keeps user signal and drops unrelated placeholders */
export function validatePrompt(prompt, slots, kind = "") {
  const p = String(prompt || "").toLowerCase();
  const errors = [];
  const required = requiredTokensFor(slots);
  const hit = required.filter((w) => p.includes(String(w).toLowerCase()));
  const needHits = Math.min(2, required.length);
  if (required.length && hit.length < needHits) {
    errors.push(`missing user words: need some of [${required.slice(0, 6).join(", ")}]`);
  }
  for (const bad of forbiddenTokensFor(slots)) {
    if (p.includes(String(bad).toLowerCase())) {
      errors.push(`unrelated token: ${bad}`);
    }
  }
  if (kind !== "image" && !/situation:/i.test(prompt)) {
    errors.push("missing Situation known-fact");
  }
  if (looksLikeFinishedWork(prompt)) {
    errors.push("looks like finished work, not a prompt");
  }
  // Support-writing false mail
  if (/\bsupport writing\b/i.test(slots.raw) && /\b(customer support|ticket id|support desk)\b/i.test(prompt)) {
    errors.push("misclassified as support-desk email");
  }
  return { ok: errors.length === 0, errors, hit };
}

function repairPrompt(prompt, slots, placeholders, kind) {
  let p = String(prompt || "");
  if (kind !== "image" && !/## Known facts/i.test(p) && !/<known_facts>/i.test(p)) {
    p = p.replace(
      /## Audience & tone[\s\S]*?(## Process)/i,
      (m, g1) =>
        `## Audience & tone\n- Audience: ${slots.recipient ? slots.recipient.label : "[audience]"}\n- Tone: ${tonePhrase(slots, false)}\n\n## Known facts\n- Situation: ${slots.situation}\n- Do not invent names, dates, metrics, employers, or credentials.\n\n${g1}`
    );
  }
  if (kind !== "image" && !/Situation:/i.test(p)) {
    if (/## Known facts\n/i.test(p)) {
      p = p.replace(/## Known facts\n/i, `## Known facts\n- Situation: ${slots.situation}\n`);
    } else {
      p = `${p}\n\n## Known facts\n- Situation: ${slots.situation}\n`;
    }
  }
  const forbidden = forbiddenTokensFor(slots);
  if (forbidden.length) {
    p = p
      .split("\n")
      .filter((line) => {
        const isPlaceholderLine =
          /^\s*-\s*\[/.test(line) ||
          /\[current deadline\]|\[requested date\]|\[manager name\]|\[boss/i.test(line);
        if (!isPlaceholderLine) return true;
        const l = line.toLowerCase();
        return !forbidden.some((f) => l.includes(String(f).toLowerCase()));
      })
      .join("\n");
  }
  if (placeholders.length && /## Fill these placeholders/i.test(p)) {
    const block = placeholders.map((x) => `- ${x}`).join("\n");
    p = p.replace(
      /## Fill these placeholders before sending[\s\S]*$/i,
      `## Fill these placeholders before sending\n${block}`
    );
  }
  return p;
}

function emptyResult() {
  return normalizeResult({
    understood: "You want a prompt, and there is no idea yet.",
    corrected_request: "",
    task_type: "other",
    target: "chat",
    assumptions: [],
    prompt: "",
    tweaks: ["Add the goal", "Name the audience", "Pick image or chat"],
    fill_hints: [],
    questions: [],
    mode: "offline",
    notice: ""
  });
}

/**
 * Local draft — slot-driven templates.
 */
export function coachOffline(rawInput, tweak = "", shape = "auto", answers = {}) {
  const input = String(rawInput || "").trim().slice(0, INPUT_MAX_CHARS);
  if (!input) return emptyResult();

  let slots = extractSlots(input);
  slots = enrichWithAnswers(slots, answers);

  const source = `${input} ${tweak || ""}`;
  let type = slots.taskType;
  let target = slots.target;
  ({ type, target } = applyShape(type, target, shape));

  const shorter = /shorter|brief|concise/i.test(tweak);
  const formal = /formal/i.test(tweak);
  const tool = detectTool(source);

  const kind = resolveKind(slots, type, target, input);
  let role = ROLE_BY_TYPE[type] || ROLE_BY_TYPE.other;
  if (kind === "homework") {
    type = "explain";
    role = ROLE_BY_TYPE.explain;
  } else if (kind === "resume" || slots.mailScenario) {
    type = "write";
    role = ROLE_BY_TYPE.write;
  }

  const goal = kind === "image" ? "" : buildGoal(kind, slots, input, type);
  const placeholders = placeholdersFor(slots, kind);

  let prompt =
    kind === "image"
      ? buildImagePrompt(tidy(input), tool, source)
      : buildPromptFromSlots({
          role,
          goal,
          slots,
          kind,
          shorter,
          formal,
          tool,
          answers,
          placeholders
        });

  if (kind === "image" && answers.medium) {
    prompt = prompt.replace("[medium]", answers.medium).replace("[photo / illustration / 3D]", answers.medium);
  }

  prompt = repairPrompt(prompt, slots, placeholders, kind);
  let validation = validatePrompt(prompt, slots, kind);

  if (!validation.ok && kind !== "image") {
    // Rebuild from slots if model-like corruption / finished work / missing situation
    prompt = buildPromptFromSlots({
      role,
      goal: goal || buildGoal(kind, slots, input, type),
      slots,
      kind,
      shorter,
      formal,
      tool,
      answers,
      placeholders
    });
    prompt = repairPrompt(prompt, slots, placeholders, kind);
    validation = validatePrompt(prompt, slots, kind);
  }

  const assumptions = ["Missing personal details stay as placeholders — nothing was invented."];
  if (slots.mailScenario) {
    assumptions.push(
      `Treated as a ${slots.mailScenario.replace(/_/g, "-")} ${channelLabel(slots.channel)} from the user's words.`
    );
  }
  if (kind === "homework") {
    assumptions.push("Treated as a learning request, not a finished-submission request.");
  }
  if (slots.channel === "whatsapp" || slots.channel === "sms") {
    assumptions.push("Kept short and natural for messaging — not a formal email layout.");
  }

  const label = target === "image" ? "image" : target === "code" ? "coding" : "chat";
  const article = /^[aeiou]/i.test(label) ? "an" : "a";
  const low = slots.confidence < 0.55 || !validation.ok;

  return normalizeResult({
    understood: `You want ${article} detailed ${label} prompt for this, not the finished piece itself.`,
    corrected_request: (goal || slots.situation).replace(/\s+/g, " ").trim(),
    task_type: type,
    target: target === "image" ? "image" : target === "code" ? "code" : "chat",
    assumptions,
    prompt,
    tweaks: tweakLabels({ shorter, formal, target, kind, slots }),
    fill_hints: placeholders,
    questions: questionsFor(slots, kind, answers),
    mode: "offline",
    notice: low
      ? !validation.ok
        ? `Local draft needs care: ${validation.errors.slice(0, 2).join("; ")}. Add a Gemini key for better results.`
        : "Local draft is basic. Add a Gemini key for better results."
      : "",
    confidence: slots.confidence,
    slots: {
      recipient: slots.recipient?.id || "",
      scenario: slots.mailScenario || kind,
      situation: slots.situation,
      channel: slots.channel,
      intent: slots.intent
    },
    validation
  });
}

export function buildUserMessage(rawInput, tweak, previousPrompt, shape, answers) {
  const slots = extractSlots(rawInput);
  const parts = [
    `User idea:\n"""${String(rawInput || "").trim().slice(0, INPUT_MAX_CHARS)}"""`,
    `Extracted slots (use these; do not invent others):\n${JSON.stringify(
      {
        recipient: slots.recipient?.label || null,
        duration: slots.duration || null,
        length: slots.lengthConstraint || null,
        tone: slots.tone,
        situation: slots.situation,
        mail_scenario: slots.mailScenario || null,
        channel: slots.channel,
        intent: slots.intent
      },
      null,
      2
    )}`,
    "Write a DETAILED prompt unless they asked for shorter.",
    'ALWAYS include Known facts with a line starting exactly: Situation: <cleaned user facts>.',
    "Placeholders must match THIS scenario only (no boss/deadline fields unless the user asked about those).",
    "Return a prompt/brief — never the finished email, essay, or full code solution."
  ];
  if (shape && shape !== "auto") parts.push(`Forced shape: ${shape}.`);
  if (answers && Object.keys(answers).length) {
    parts.push(`User refine answers:\n${JSON.stringify(answers)}`);
  }
  if (tweak) parts.push(`Revise previous prompt. Change only what this asks:\n"""${tweak}"""`);
  if (previousPrompt) parts.push(`Previous prompt:\n"""${previousPrompt}"""`);
  return parts.join("\n\n");
}

export function normalizeResult(obj) {
  const tweaks = Array.isArray(obj.tweaks)
    ? obj.tweaks.map(String).filter(Boolean).slice(0, 3)
    : [];
  while (tweaks.length < 3) tweaks.push("Make it more detailed");

  const questions = Array.isArray(obj.questions)
    ? obj.questions
        .slice(0, 2)
        .map((q, i) => ({
          id: String(q?.id || `q${i + 1}`),
          label: String(q?.label || "Add a detail"),
          placeholder: String(q?.placeholder || "")
        }))
        .filter((q) => q.label)
    : [];

  return {
    understood: String(obj.understood || "You want a better prompt."),
    corrected_request: String(obj.corrected_request || obj.correctedRequest || ""),
    task_type: String(obj.task_type || obj.taskType || "other"),
    target: ["chat", "image", "code"].includes(obj.target) ? obj.target : "chat",
    assumptions: Array.isArray(obj.assumptions) ? obj.assumptions.map(String).slice(0, 4) : [],
    prompt: String(obj.prompt || ""),
    tweaks,
    fill_hints: Array.isArray(obj.fill_hints || obj.fillHints)
      ? (obj.fill_hints || obj.fillHints).map(String).slice(0, 8)
      : [],
    questions,
    mode: obj.mode || "offline",
    notice: String(obj.notice || ""),
    model: obj.model || "",
    error_code: obj.error_code || "",
    confidence: typeof obj.confidence === "number" ? obj.confidence : undefined,
    slots: obj.slots || undefined,
    validation: obj.validation || undefined
  };
}

export function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const visible = parts
    .filter((part) => !part.thought && part.text)
    .map((part) => part.text)
    .join("");
  if (visible.trim()) return visible;
  return parts.map((part) => part.text || "").join("");
}

export function parseCoachJson(text, mode = "online") {
  if (!text || !String(text).trim()) {
    const err = new Error("Model returned an empty response.");
    err.code = "empty";
    throw err;
  }
  let cleaned = String(text).trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    const err = new Error("Model response was not valid JSON.");
    err.code = "bad_json";
    throw err;
  }
  let obj;
  try {
    obj = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    const err = new Error("Model response was not valid JSON.");
    err.code = "bad_json";
    throw err;
  }
  if (!obj.prompt || !obj.understood) {
    const err = new Error("Model JSON was missing required fields.");
    err.code = "bad_json";
    throw err;
  }
  return normalizeResult({ ...obj, mode });
}

function offlineKindFromSlots(slots) {
  if (slots.isResume) return "resume";
  if (slots.mailScenario) return slots.mailScenario;
  if (slots.intent === "video") return "video";
  if (slots.intent === "translate") return "translate";
  if (slots.intent === "code") return "code";
  if (slots.intent === "image") return "image";
  if (slots.intent === "homework") return "homework";
  if (slots.intent === "data") return "data";
  if (slots.intent === "plan") return "plan";
  if (slots.intent === "research") return "research";
  return "other";
}

/** Post-check online output; rebuild from offline if still bad */
export function hardenOnlineResult(result, rawInput) {
  const slots = extractSlots(rawInput);
  const kind = offlineKindFromSlots(slots);
  let prompt = String(result.prompt || "");
  const placeholders = placeholdersFor(slots, kind);

  if (looksLikeFinishedWork(prompt) || (kind !== "image" && !/Situation:/i.test(prompt))) {
    // Prefer local rebuild for structural failures
    const local = coachOffline(rawInput, "", "auto", {});
    if (local.prompt && (!looksLikeFinishedWork(local.prompt) || kind === "image")) {
      return normalizeResult({
        ...result,
        prompt: local.prompt,
        fill_hints: local.fill_hints,
        assumptions: result.assumptions?.length ? result.assumptions : local.assumptions,
        tweaks: result.tweaks?.length ? result.tweaks : local.tweaks,
        questions: result.questions?.length ? result.questions : local.questions,
        notice:
          result.notice ||
          "Online draft was rebuilt locally to stay faithful and avoid finishing the task.",
        validation: local.validation,
        slots: local.slots
      });
    }
  }

  prompt = repairPrompt(prompt, slots, placeholders, kind);
  let validation = validatePrompt(prompt, slots, kind);

  if (!validation.ok && kind !== "image") {
    const local = coachOffline(rawInput, "", "auto", {});
    const localVal = validatePrompt(local.prompt, slots, kind);
    if (localVal.ok || (localVal.errors?.length || 99) <= (validation.errors?.length || 99)) {
      return normalizeResult({
        ...result,
        prompt: local.prompt,
        fill_hints: local.fill_hints,
        notice:
          result.notice ||
          "Online prompt was replaced with a tighter local draft to keep your words.",
        validation: local.validation,
        slots: local.slots
      });
    }
  }

  const notice =
    result.notice ||
    (!validation.ok
      ? "Online prompt was adjusted to keep your words and drop unrelated placeholders."
      : "");

  return normalizeResult({
    ...result,
    prompt,
    fill_hints: result.fill_hints?.length && validation.ok ? result.fill_hints : placeholders,
    notice,
    validation,
    slots: {
      recipient: slots.recipient?.id || "",
      scenario: slots.mailScenario || kind,
      situation: slots.situation,
      channel: slots.channel,
      intent: slots.intent
    }
  });
}

export function classifyError(status, message, provider = "gemini") {
  const msg = String(message || "");
  const name = provider === "groq" ? "Groq" : "Gemini";
  const keyUrl = provider === "groq" ? "console.groq.com" : "aistudio.google.com/apikey";

  if (
    status === 401 ||
    status === 403 ||
    /invalid api key|api key|authentication|unauthorized|permission|API_KEY/i.test(msg)
  ) {
    return {
      code: "bad_key",
      message: `That ${name} API key looks wrong. Open settings and paste a new key from ${keyUrl}.`
    };
  }
  if (status === 429 || /rate limit|too many requests|quota|resource.?exhausted/i.test(msg)) {
    return {
      code: "rate_limit",
      message: `${name} rate limit hit. Wait a minute, or switch to Fast / local draft.`
    };
  }
  if (/timeout|timed out|abort/i.test(msg)) {
    return {
      code: "timeout",
      message: "The request timed out. Try again, or use Fast / local draft."
    };
  }
  if (/json|empty|missing required/i.test(msg)) {
    return {
      code: "bad_json",
      message: "The model returned a broken response. Showing local draft."
    };
  }
  return {
    code: "network",
    message: msg || `Could not reach ${name}. Check your connection, then try again.`
  };
}
