#!/usr/bin/env python3
"""
Transform all plain blog pages to use blog-pages.css landing-page style.
Skips pages already using mock-pages.css or blog-pages.css.
"""
import os
import re
from html.parser import HTMLParser

BLOG_DIR = '/Users/kevinjohal/Desktop/teachingsuccess/blog'

FONTS_AND_CSS = '''  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../assets/css/index.css">
  <link rel="stylesheet" href="../assets/css/blog-pages.css">'''

NAVBAR = '''  <nav class="navbar">
    <div class="nlogo">
      <div class="nlogo-mark" aria-hidden="true">TS</div>
      <div class="nlogo-txt">Teaching <span>Success</span></div>
    </div>
    <div class="nnav">
      <div class="nlinks">
        <a href="/tutor-network.html#tutors">Our Tutors</a>
        <a href="/tutor-network.html#network">Tutor Network</a>
        <a href="/#levels">Subjects &amp; Levels</a>
        <a href="/#reviews">Reviews</a>
      </div>
    </div>
    <div class="nacts">
      <a class="nphone" href="tel:07909274901">07909 274901</a>
    </div>
  </nav>'''

TRUST_BAR = '''  <div class="blp-trust">
    <div class="blp-trust-item"><span>✓</span> Qualified Teachers</div>
    <div class="blp-trust-item"><span>⭐</span> 5-Star Rated</div>
    <div class="blp-trust-item"><span>📍</span> Smethwick &amp; Birmingham</div>
    <div class="blp-trust-item"><span>🎯</span> Free Trial Session</div>
    <div class="blp-trust-item"><span>💷</span> From £15/hr</div>
  </div>'''

SIDEBAR = '''    <aside class="blp-sidebar">
      <div class="blp-cta-card">
        <h3>Book a Free Trial</h3>
        <p>See the difference qualified, teacher-led tuition makes. No commitment needed.</p>
        <a href="tel:07909274901" class="blp-phone-big">📞 07909 274901</a>
        <a href="/" class="btn btn-gold">Book Free Trial</a>
        <a href="mailto:hello@teachingsuccess.co.uk" class="btn btn-ghost">Email Us</a>
      </div>
      <div class="blp-info-card">
        <h4>Quick Facts</h4>
        <ul class="blp-info-list">
          <li>In-person in Smethwick &amp; Birmingham</li>
          <li>Online sessions available UK-wide</li>
          <li>From £15/hr — no hidden fees</li>
          <li>Qualified teachers, not just graduates</li>
          <li>Free first session, no commitment</li>
        </ul>
      </div>
    </aside>'''

CTA_BAND = '''  <section class="blp-cta-band">
    <div class="blp-cta-band-in">
      <div>
        <h2>Ready to Make Real Progress?</h2>
        <p>Book a free trial session with Teaching Success. Qualified teachers, personalised plans, results that last.</p>
      </div>
      <div class="blp-cta-band-btns">
        <a href="tel:07909274901" class="btn btn-gold">📞 07909 274901</a>
        <a href="/" class="btn btn-ghost">Book Free Trial</a>
      </div>
    </div>
  </section>'''

FOOTER = '''  <footer class="footer">
    <p class="footer-brand">Teaching Success</p>
    <nav class="footer-links" aria-label="Footer">
      <a href="tel:07909274901">07909 274901</a>
      <a href="/blog.html">Blog</a>
      <a href="/">Book Trial</a>
    </nav>
  </footer>'''


def get_eyebrow(filename, h1_text):
    f = filename.lower()
    h = h1_text.lower()
    if 'a-level' in f or 'a level' in h:
        return 'A-Level Support'
    if 'gcse' in f or 'gcse' in h:
        return 'GCSE Tuition'
    if 'mock' in f or 'mock' in h:
        return 'Mock Exam Practice'
    if 'primary' in f or 'year 1' in h or 'year 2' in h or 'year 3' in h or 'year 4' in h:
        return 'Primary Tuition'
    if 'english' in f or 'english' in h:
        return 'English Tuition'
    if 'science' in f or 'biology' in f or 'chemistry' in f or 'physics' in f:
        return 'Science Tuition'
    if 'maths' in f or 'math' in f or 'maths' in h:
        return 'Maths Tuition'
    if 'revision' in f or 'exam' in f:
        return 'Exam Preparation'
    if 'tutor' in f:
        return 'Expert Tuition'
    return 'Expert Tuition'


def extract_text(html_frag):
    """Strip HTML tags from a fragment."""
    return re.sub(r'<[^>]+>', '', html_frag).strip()


def parse_article_sections(article_html):
    """
    Split article inner HTML into (intro_html, sections) where:
    - intro_html: content before first h2 (excluding h1)
    - sections: list of {'h2': str, 'content_html': str}
    """
    # Remove the h1
    body = re.sub(r'<h1[^>]*>.*?</h1>', '', article_html, flags=re.DOTALL)

    # Split by h2 tags
    # We'll collect everything before first h2 as intro
    h2_pattern = re.compile(r'(<h2[^>]*>.*?</h2>)', re.DOTALL | re.IGNORECASE)
    parts = h2_pattern.split(body)

    intro_html = parts[0].strip()
    sections = []

    i = 1
    while i < len(parts):
        h2_tag = parts[i]
        h2_text = extract_text(h2_tag)
        content = parts[i + 1].strip() if i + 1 < len(parts) else ''
        sections.append({'h2': h2_text, 'content_html': content})
        i += 2

    return intro_html, sections


def extract_related_links(sections):
    """Find and remove the 'Related' section, return its links."""
    related_links = []
    related_idx = None

    for i, section in enumerate(sections):
        h2_lower = section['h2'].lower()
        if 'related' in h2_lower:
            # Extract links
            link_pattern = re.compile(r'<a\s+href="([^"]*)"[^>]*>(.*?)</a>', re.DOTALL | re.IGNORECASE)
            for m in link_pattern.finditer(section['content_html']):
                href = m.group(1)
                text = extract_text(m.group(2))
                if text and href:
                    related_links.append({'href': href, 'text': text})
            related_idx = i
            break

    if related_idx is not None:
        sections.pop(related_idx)

    return related_links


def build_sections_html(sections):
    html = ''
    for section in sections:
        html += f'''
      <div class="blp-section">
        <h2>{section["h2"]}</h2>
        {section["content_html"]}
      </div>'''
    return html


def build_related_html(related_links):
    if not related_links:
        return ''
    links_html = '\n        '.join(
        f'<a href="{r["href"]}">{r["text"]}</a>' for r in related_links
    )
    return f'''  <div class="blp-related">
    <div class="blp-related-inner">
      <span class="blp-related-label">Related Guides</span>
      {links_html}
    </div>
  </div>'''


def transform_page(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    # Skip already transformed pages
    if 'blog-pages.css' in html or 'mock-pages.css' in html:
        return False, 'already transformed'

    # --- HEAD MODIFICATIONS ---

    # Remove inline <style> block
    html = re.sub(r'\s*<style>.*?</style>', '', html, flags=re.DOTALL)

    # Remove any existing font links to avoid duplicates
    html = re.sub(r'\s*<link[^>]+fonts\.googleapis[^>]+>', '', html)
    html = re.sub(r'\s*<link[^>]+fonts\.gstatic[^>]+>', '', html)
    html = re.sub(r'\s*<link[^>]+rel="preconnect"[^>]+>', '', html)

    # Insert fonts + css before </head>
    html = html.replace('</head>', FONTS_AND_CSS + '\n</head>', 1)

    # --- EXTRACT CONTENT ---

    # Get H1
    h1_match = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL | re.IGNORECASE)
    h1_text = extract_text(h1_match.group(1)) if h1_match else 'Expert Tuition'

    # Get meta description
    desc_match = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html, re.IGNORECASE)
    meta_desc = desc_match.group(1) if desc_match else ''

    # Get article content
    article_match = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL | re.IGNORECASE)
    if not article_match:
        return False, 'no article found'

    article_inner = article_match.group(1)
    intro_html, sections = parse_article_sections(article_inner)
    related_links = extract_related_links(sections)

    filename = os.path.basename(filepath)
    eyebrow = get_eyebrow(filename, h1_text)

    # Hero sub — use meta description
    hero_sub = meta_desc

    sections_html = build_sections_html(sections)
    related_html = build_related_html(related_links)

    # --- BUILD NEW BODY ---
    new_body_content = f'''{NAVBAR}

  <section class="blp-hero">
    <div class="blp-hero-in">
      <div class="blp-eyebrow">⭐ {eyebrow}</div>
      <h1>{h1_text}</h1>
      <p class="blp-sub">{hero_sub}</p>
      <div class="blp-btns">
        <a href="tel:07909274901" class="btn btn-gold">📞 Call 07909 274901</a>
        <a href="/" class="btn btn-ghost">Book Free Trial</a>
      </div>
    </div>
  </section>

{TRUST_BAR}

  <div class="blp-body">
    <main class="blp-main">{sections_html}
    </main>
{SIDEBAR}
  </div>

{related_html}

{CTA_BAND}

{FOOTER}'''

    # Replace body tag and its content
    # Replace <body> opening
    html = re.sub(r'<body[^>]*>', '<body class="blog-lp">', html, count=1)

    # Replace everything from <main class="wrap"> to </main> (or from <body> content)
    # The body content starts after <body> tag
    body_content_pattern = re.compile(
        r'(<body[^>]*>)\s*<main class="wrap">.*?</main>\s*(</body>)',
        re.DOTALL | re.IGNORECASE
    )
    if body_content_pattern.search(html):
        html = body_content_pattern.sub(
            r'\1\n' + new_body_content + r'\n\2',
            html
        )
    else:
        # Fallback: replace everything between <body> tags
        html = re.sub(
            r'(<body[^>]*>).*?(</body>)',
            r'\1\n' + new_body_content + r'\n\2',
            html,
            flags=re.DOTALL | re.IGNORECASE
        )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)

    return True, 'transformed'


def main():
    files = sorted([
        f for f in os.listdir(BLOG_DIR)
        if f.endswith('.html')
    ])

    transformed = 0
    skipped = 0
    errors = []

    for filename in files:
        filepath = os.path.join(BLOG_DIR, filename)
        success, reason = transform_page(filepath)
        if success:
            transformed += 1
            print(f'  ✓ {filename}')
        else:
            skipped += 1
            print(f'  – {filename} ({reason})')

    print(f'\nDone: {transformed} transformed, {skipped} skipped')
    if errors:
        print('Errors:', errors)


if __name__ == '__main__':
    main()
