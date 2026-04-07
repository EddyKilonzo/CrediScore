import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface CrediPalMessage {
  role: 'bot' | 'user';
  text: string;
}

interface CrediPalPrompt {
  label: string;
  intent: string;
}

@Component({
  selector: 'app-credipal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './credipal.component.html',
  styleUrl: './credipal.component.css',
})
export class CrediPalComponent {
  isOpen = false;
  isExpanded = false;
  isTyping = false;
  question = '';

  messages: CrediPalMessage[] = [
    {
      role: 'bot',
      text: 'Hi, I am CrediPal. I can guide you on how to use CrediScore. Pick any question below to get started.',
    },
  ];

  prompts: CrediPalPrompt[] = [
    { label: 'How do I find businesses quickly?', intent: 'search' },
    { label: 'How do I leave a helpful review?', intent: 'review' },
    { label: 'How do trust scores and rankings work?', intent: 'scores' },
    { label: 'How do I report a suspicious business?', intent: 'report' },
    { label: 'How do I manage my account and activity?', intent: 'account' },
    { label: 'Explain user vs business vs admin areas', intent: 'roles' },
  ];

  constructor(private router: Router) {}

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) {
      this.isExpanded = false;
    }
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  ask(prompt: CrediPalPrompt): void {
    this.messages = [...this.messages, { role: 'user', text: prompt.label }];
    this.pushBotReply(this.getReply(prompt.intent));
  }

  askQuestion(): void {
    const value = this.question.trim();
    if (!value) return;
    this.messages = [...this.messages, { role: 'user', text: value }];
    this.question = '';
    this.pushBotReply(this.getReplyFromQuestion(value));
  }

  goTo(path: string): void {
    this.router.navigateByUrl(path);
    if (!this.isOpen) return;
    this.messages = [
      ...this.messages,
      { role: 'user', text: `Take me to ${path}` },
      { role: 'bot', text: `Opening ${path}. I am still here if you need help with what to do next.` },
    ];
  }

  private getReply(intent: string): string {
    if (intent === 'search') {
      return 'Go to Search to discover businesses by name or category, then open a business profile to compare trust score, reviews, and trends before deciding.';
    }
    if (intent === 'review') {
      return 'Open a business page, rate fairly, and write clear details about your real experience. Helpful and consistent reviews improve community trust.';
    }
    if (intent === 'scores') {
      return 'Trust signals combine review quality, verification, and activity patterns. Use Leaderboard and business score cards to spot reliable businesses and reviewers.';
    }
    if (intent === 'report') {
      return 'Use Report Business from your user area when you notice fraud, abuse, or unsafe behavior. Include concrete evidence so moderators can act quickly.';
    }
    if (intent === 'account') {
      return 'Use Dashboard, My Reviews, Bookmarks, and Profile to track your activity, manage saved businesses, and improve your contributor reputation over time.';
    }
    if (intent === 'roles') {
      return 'Customers can search, review, bookmark, and report businesses. Business owners manage analytics and their business profile. Admins moderate reports, reviews, documents, and system safety queues.';
    }
    return 'Use the navigation menu to move between Search, Dashboard, Leaderboard, and Profile. I can guide you through each section.';
  }

  private getReplyFromQuestion(question: string): string {
    const normalized = question.toLowerCase();

    if (normalized.includes('search') || normalized.includes('find')) {
      return 'To search effectively: 1) Start in Search and use business name/category keywords. 2) Open a business profile and compare trust score, review count, and review recency. 3) Use compare/map views when deciding between multiple options.';
    }
    if (normalized.includes('review') || normalized.includes('rate')) {
      return 'For high-quality reviews: include what happened, when it happened, and what outcome you got. Keep feedback specific, fair, and evidence-based. Avoid vague one-liners; detailed, honest reviews improve trust signals.';
    }
    if (normalized.includes('trust score') || normalized.includes('score') || normalized.includes('ranking')) {
      return 'Scores and ranking consider multiple trust signals: quality of reviews, volume/consistency, verification cues, and activity patterns. Use leaderboard to identify trusted contributors and business pages to inspect score context before action.';
    }
    if (normalized.includes('report') || normalized.includes('fraud') || normalized.includes('suspicious')) {
      return 'When reporting abuse: go to Report Business, describe the issue clearly, and include concrete evidence (dates, screenshots, references). Reports flow to moderation/admin review queues for investigation and action.';
    }
    if (normalized.includes('dashboard') || normalized.includes('profile') || normalized.includes('bookmarks')) {
      return 'Account tools: Dashboard shows your activity snapshot, My Reviews tracks your contributions, Bookmarks saves businesses for later, and Profile manages identity/account settings.';
    }
    if (normalized.includes('admin') || normalized.includes('role') || normalized.includes('permission')) {
      return 'Role areas are separated: users focus on discovery/reviews, business owners manage business performance, and admins handle trust & safety operations. If a page is hidden, your account role likely does not grant that route.';
    }
    if (normalized.includes('how') || normalized.includes('what') || normalized.includes('help')) {
      return 'I can answer in depth about search flow, review workflow, trust scoring, reporting, dashboards, role access, and leaderboards. Ask a direct question like "How is trust score used when comparing businesses?"';
    }

    return 'I can help deeply with platform usage. Try asking about: search strategy, review quality standards, trust score interpretation, reporting suspicious activity, or role-based access in CrediScore.';
  }

  private pushBotReply(text: string): void {
    this.isTyping = true;
    setTimeout(() => {
      this.messages = [...this.messages, { role: 'bot', text }];
      this.isTyping = false;
    }, 350);
  }
}
