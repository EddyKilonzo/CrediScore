import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

interface CrediPalMessage {
  role: 'bot' | 'user';
  text: string;
}

interface CrediPalPrompt {
  label: string;
  intent: string;
}

interface QuickNavLink {
  label: string;
  path: string;
  hint: string;
}

@Component({
  selector: 'app-credipal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './credipal.component.html',
  styleUrl: './credipal.component.css',
})
export class CrediPalComponent {
  isOpen = false;
  isExpanded = false;
  isTyping = false;
  question = '';
  showQuickQuestions = false;
  showQuickActions = false;

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
  quickNavigationLinks: QuickNavLink[] = [
    { label: 'Open Search', path: '/search', hint: 'Find and compare businesses' },
    { label: 'Open Dashboard', path: '/dashboard', hint: 'Track your account activity' },
    { label: 'Open Leaderboard', path: '/leaderboard', hint: 'View trust and ranking leaders' },
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

  toggleQuickQuestions(): void {
    this.showQuickQuestions = !this.showQuickQuestions;
  }

  toggleQuickActions(): void {
    this.showQuickActions = !this.showQuickActions;
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
      return this.structuredReply('Search effectively', [
        'Start in Search and use business name or category keywords.',
        'Open a business profile and compare trust score, review volume, and recency.',
        'Use compare/map views when choosing between options.',
      ]);
    }
    if (intent === 'review') {
      return this.structuredReply('Write helpful reviews', [
        'Rate fairly based on your real experience.',
        'Include what happened, when, and the outcome.',
        'Keep feedback specific and evidence-based.',
      ]);
    }
    if (intent === 'scores') {
      return this.structuredReply('How scoring works', [
        'Trust signals combine review quality, verification, and behavior patterns.',
        'Leaderboard highlights trusted contributors.',
        'Business cards provide score context before decisions.',
      ]);
    }
    if (intent === 'report') {
      return this.structuredReply('Report suspicious activity', [
        'Go to Report Business from your user area.',
        'Describe the issue clearly and add evidence (dates/screenshots).',
        'Reports are routed to moderation and admin investigation queues.',
      ]);
    }
    if (intent === 'account') {
      return this.structuredReply('Manage your account', [
        'Dashboard shows your activity summary.',
        'My Reviews tracks your contributions.',
        'Bookmarks and Profile help you organize and maintain account details.',
      ]);
    }
    if (intent === 'roles') {
      return this.structuredReply('Role areas in CrediScore', [
        'Customers: search, review, bookmark, and report businesses.',
        'Business owners: manage business profile and analytics.',
        'Admins: moderate reports, reviews, documents, and system safety workflows.',
      ]);
    }
    return this.structuredReply('Getting started', [
      'Use Quick Navigation links to jump between core pages.',
      'Ask direct questions about search, reviews, scores, or reporting.',
      'I can guide you step-by-step through each flow.',
    ]);
  }

  private getReplyFromQuestion(question: string): string {
    const normalized = question.toLowerCase();

    if (normalized.includes('search') || normalized.includes('find')) {
      return this.structuredReply('Search strategy', [
        'Use business name/category keywords first.',
        'Compare trust score, review count, and review recency.',
        'Use compare/map to narrow down final options.',
      ]);
    }
    if (normalized.includes('review') || normalized.includes('rate')) {
      return this.structuredReply('Review quality checklist', [
        'Include what happened, when it happened, and the outcome.',
        'Keep language fair, specific, and factual.',
        'Avoid vague one-liners; details improve trust signals.',
      ]);
    }
    if (normalized.includes('trust score') || normalized.includes('score') || normalized.includes('ranking')) {
      return this.structuredReply('Trust score and ranking', [
        'Scoring uses review quality, volume consistency, verification, and behavior signals.',
        'Leaderboard helps identify trusted contributors.',
        'Business pages show score context to support decisions.',
      ]);
    }
    if (normalized.includes('report') || normalized.includes('fraud') || normalized.includes('suspicious')) {
      return this.structuredReply('Reporting flow', [
        'Go to Report Business.',
        'Provide concrete evidence (dates, screenshots, references).',
        'Moderation/admin teams review and act on valid reports.',
      ]);
    }
    if (normalized.includes('dashboard') || normalized.includes('profile') || normalized.includes('bookmarks')) {
      return this.structuredReply('Account tools', [
        'Dashboard: activity snapshot.',
        'My Reviews: contribution history.',
        'Bookmarks/Profile: saved businesses and account settings.',
      ]);
    }
    if (normalized.includes('admin') || normalized.includes('role') || normalized.includes('permission')) {
      return this.structuredReply('Roles and permissions', [
        'Users: discovery and reviews.',
        'Business owners: business performance and profile tools.',
        'Admins: trust and safety operations.',
      ]);
    }
    if (normalized.includes('how') || normalized.includes('what') || normalized.includes('help')) {
      return this.structuredReply('What I can help with', [
        'Search and comparison workflow.',
        'Review quality and trust scoring.',
        'Reporting, dashboard usage, and role access.',
      ]);
    }

    return this.structuredReply('Try asking', [
      'How do I compare two businesses?',
      'How is trust score interpreted?',
      'How do I report suspicious activity correctly?',
    ]);
  }

  private structuredReply(title: string, points: string[]): string {
    const body = points.map((point) => `- ${point}`).join('\n');
    return `${title}\n${body}`;
  }

  private pushBotReply(text: string): void {
    this.isTyping = true;
    setTimeout(() => {
      this.messages = [...this.messages, { role: 'bot', text }];
      this.isTyping = false;
    }, 350);
  }
}
