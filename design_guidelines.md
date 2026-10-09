{
  "meta": {
    "product": "Backoffice MLM (Indonesia) — Admin Pusat/Provinsi, Stokis, Member",
    "ui_language": "Bahasa Indonesia",
    "theme": "Light (default)",
    "design_personality": [
      "tepercaya & rapi (fintech-like)",
      "lebih berwarna tapi tetap harmonis",
      "compact / data-dense",
      "status-first (warna + label + ikon)"
    ],
    "gradient_policy": {
      "restriction": "Ikuti GRADIENT RESTRICTION RULE di bagian akhir dokumen. Gunakan gradient hanya sebagai aksen dekoratif (hero/dashboard header) dan maksimal 20% viewport.",
      "allowed_usage": [
        "background header dashboard (subtle)",
        "accent strip pada StatCard",
        "decorative overlay kecil (noise + tint)"
      ]
    }
  },

  "design_tokens": {
    "paste_into_index_css_root": {
      "note": "Semua nilai HSL tanpa fungsi hsl(). Paste ke :root di /app/frontend/src/index.css. Token baru ditambahkan tanpa menghapus token lama.",
      "existing_tokens_updated": {
        "--background": "36 33% 98%",
        "--foreground": "200 18% 12%",
        "--card": "0 0% 100%",
        "--card-foreground": "200 18% 12%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "200 18% 12%",

        "--primary": "174 62% 28%",
        "--primary-foreground": "0 0% 98%",

        "--secondary": "36 28% 94%",
        "--secondary-foreground": "200 18% 16%",

        "--muted": "36 22% 93%",
        "--muted-foreground": "200 10% 40%",

        "--accent": "186 45% 92%",
        "--accent-foreground": "200 18% 16%",

        "--destructive": "0 72% 52%",
        "--destructive-foreground": "0 0% 98%",

        "--border": "36 18% 86%",
        "--input": "36 18% 86%",
        "--ring": "174 62% 28%",

        "--radius": "0.625rem",

        "--chart-1": "174 62% 28%",
        "--chart-2": "199 70% 38%",
        "--chart-3": "36 55% 55%",
        "--chart-4": "160 45% 35%",
        "--chart-5": "210 55% 45%"
      },

      "new_semantic_tokens": {
        "--surface": "36 33% 99%",
        "--surface-2": "36 22% 96%",
        "--surface-3": "36 18% 93%",

        "--ink": "200 18% 12%",
        "--ink-2": "200 14% 22%",
        "--ink-3": "200 10% 40%",

        "--primary-2": "186 58% 34%",
        "--primary-soft": "174 55% 92%",
        "--primary-soft-foreground": "174 62% 18%",

        "--info": "199 78% 40%",
        "--info-foreground": "0 0% 98%",
        "--info-soft": "199 70% 92%",
        "--info-soft-foreground": "199 70% 22%",

        "--success": "158 55% 32%",
        "--success-foreground": "0 0% 98%",
        "--success-soft": "158 45% 92%",
        "--success-soft-foreground": "158 55% 18%",

        "--warning": "36 85% 48%",
        "--warning-foreground": "36 100% 10%",
        "--warning-soft": "36 90% 92%",
        "--warning-soft-foreground": "36 85% 22%",

        "--danger": "0 72% 52%",
        "--danger-foreground": "0 0% 98%",
        "--danger-soft": "0 85% 94%",
        "--danger-soft-foreground": "0 70% 26%",

        "--focus": "186 58% 34%",
        "--shadow-color": "200 20% 10%",

        "--sidebar": "200 22% 14%",
        "--sidebar-foreground": "0 0% 98%",
        "--sidebar-muted": "200 18% 22%",
        "--sidebar-border": "200 18% 22%",
        "--sidebar-active": "174 62% 28%",
        "--sidebar-active-foreground": "0 0% 98%",

        "--bonus-1": "174 62% 28%",
        "--bonus-2": "199 78% 40%",
        "--bonus-3": "36 85% 48%",
        "--bonus-4": "158 55% 32%",
        "--bonus-5": "14 78% 52%",
        "--bonus-6": "220 55% 46%",
        "--bonus-7": "330 55% 46%",

        "--rank-1": "200 10% 45%",
        "--rank-2": "36 55% 55%",
        "--rank-3": "210 55% 45%",
        "--rank-4": "174 62% 28%",
        "--rank-5": "14 78% 52%",

        "--announce-pengumuman": "199 78% 40%",
        "--announce-promo": "14 78% 52%",
        "--announce-reward": "36 85% 48%",
        "--announce-penting": "0 72% 52%",
        "--announce-berita": "220 55% 46%"
      },

      "optional_css_snippets": {
        "noise_overlay": "/* gunakan hanya pada header/hero kecil */\n.noise-overlay{position:relative;}\n.noise-overlay:before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.06;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E\");mix-blend-mode:multiply;}"
      }
    }
  },

  "typography": {
    "fonts": {
      "display": "Space Grotesk (existing)",
      "body": "Work Sans (existing)",
      "numbers": "IBM Plex Mono (existing)"
    },
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-display font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "section_title": "text-lg font-display font-semibold",
      "table": "text-sm",
      "table_dense": "text-[13px]",
      "meta": "text-xs text-muted-foreground",
      "numbers": "font-mono tabular-nums"
    },
    "number_formatting": {
      "rule": "Semua Rupiah/PV/BV gunakan .font-mono + tabular-nums untuk alignment kolom."
    }
  },

  "density_spec_compact": {
    "global_layout": {
      "sidebar_width": "w-[264px] (keep)",
      "sidebar_padding": "px-3 py-3",
      "topbar_height": "h-14 (56px) keep, tapi isi lebih rapat",
      "page_padding": "px-4 md:px-6 py-4",
      "grid_gap": "gap-3 md:gap-4",
      "card_radius": "rounded-[10px] (token --radius 0.625rem)"
    },
    "control_heights": {
      "button": {
        "sm": "h-8 px-3 text-sm rounded-md",
        "md": "h-9 px-3.5 text-sm rounded-md",
        "lg": "h-10 px-4 text-sm rounded-lg"
      },
      "input": {
        "default": "h-9 text-sm",
        "dense": "h-8 text-[13px]",
        "textarea": "min-h-[88px] text-sm"
      },
      "select_trigger": "h-9 text-sm",
      "badge": "h-5 px-2 text-[11px] rounded-md",
      "tabs": "h-9",
      "dialog": {
        "header_padding": "py-3",
        "content_padding": "p-4 md:p-5",
        "footer_padding": "py-3"
      }
    },
    "tables": {
      "header": "h-9 text-[12px] uppercase tracking-wide text-muted-foreground",
      "row": "h-10",
      "cell_padding": "py-2 px-3",
      "dense_cell_padding": "py-1.5 px-2.5",
      "zebra": "odd:bg-muted/30",
      "hover": "hover:bg-accent/40",
      "selected": "data-[state=selected]:bg-primary/10"
    },
    "cards": {
      "default_padding": "p-4",
      "dense_padding": "p-3",
      "stat_card": "p-3 md:p-4",
      "card_header": "pb-2",
      "card_title": "text-sm font-medium",
      "card_value": "text-2xl font-display font-semibold"
    },
    "borders_and_shadows": {
      "border": "border border-border/70",
      "shadow": "shadow-[0_1px_0_hsl(var(--shadow-color)/0.06),0_10px_24px_hsl(var(--shadow-color)/0.08)]",
      "shadow_hover": "hover:shadow-[0_1px_0_hsl(var(--shadow-color)/0.08),0_14px_30px_hsl(var(--shadow-color)/0.10)]"
    }
  },

  "tailwind_class_recipes": {
    "note": "Bisa dibuat sebagai konstanta string di komponen .js (tanpa TS). Jangan pakai transition: all.",
    "recipes": {
      "card_c": "rounded-[10px] border border-border/70 bg-card shadow-[0_1px_0_hsl(var(--shadow-color)/0.06),0_10px_24px_hsl(var(--shadow-color)/0.08)]",
      "card_c_dense": "rounded-[10px] border border-border/70 bg-card p-3",
      "page_header": "flex flex-col gap-2 md:flex-row md:items-end md:justify-between",
      "page_title": "font-display text-xl md:text-2xl font-semibold tracking-tight",
      "page_subtitle": "text-sm text-muted-foreground",

      "input_c": "h-9 text-sm rounded-md",
      "input_c_dense": "h-8 text-[13px] rounded-md",
      "select_trigger_c": "h-9 text-sm rounded-md",

      "btn_primary_c": "h-9 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "btn_secondary_c": "h-9 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80",
      "btn_ghost_c": "h-9 rounded-md hover:bg-accent/50",

      "table_wrap_c": "rounded-[10px] border border-border/70 overflow-hidden",
      "th_c": "h-9 px-3 text-[12px] uppercase tracking-wide text-muted-foreground bg-muted/40",
      "td_c": "py-2 px-3 text-[13px]",
      "tr_c": "h-10 odd:bg-muted/30 hover:bg-accent/40",

      "badge_base": "inline-flex items-center gap-1 rounded-md px-2 h-5 text-[11px] font-medium",

      "kpi_strip_primary": "before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary",
      "kpi_strip_info": "before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[hsl(var(--info))]",
      "kpi_strip_success": "before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[hsl(var(--success))]",
      "kpi_strip_warning": "before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[hsl(var(--warning))]",
      "kpi_strip_danger": "before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[hsl(var(--danger))]"
    }
  },

  "components": {
    "component_path": {
      "shadcn_primary": {
        "button": "/app/frontend/src/components/ui/button.jsx",
        "badge": "/app/frontend/src/components/ui/badge.jsx",
        "card": "/app/frontend/src/components/ui/card.jsx",
        "dialog": "/app/frontend/src/components/ui/dialog.jsx",
        "alert": "/app/frontend/src/components/ui/alert.jsx",
        "select": "/app/frontend/src/components/ui/select.jsx",
        "table": "/app/frontend/src/components/ui/table.jsx",
        "tabs": "/app/frontend/src/components/ui/tabs.jsx",
        "calendar": "/app/frontend/src/components/ui/calendar.jsx",
        "sonner": "/app/frontend/src/components/ui/sonner.jsx"
      }
    },

    "sidebar_nav": {
      "goal": "Lebih berwarna tapi tetap enterprise: sidebar gelap netral + active teal + ikon + group headings.",
      "layout": {
        "grouping": [
          "Ringkasan (Dashboard, Pengumuman)",
          "Anggota (Members, Jaringan)",
          "Transaksi (Omset/Transaksi, Tutup Buku, Payout, Slip Bonus)",
          "Produk (Katalog, Stok)",
          "Tools (Simulator, Marketing Plan)",
          "Admin (Users, Settings)"
        ],
        "nav_item": {
          "base": "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-[hsl(var(--sidebar-foreground)/0.86)] hover:bg-[hsl(var(--sidebar-muted))]",
          "active": "bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-active-foreground))] shadow-[0_6px_18px_hsl(var(--sidebar-active)/0.25)]",
          "icon": "h-4 w-4 opacity-90",
          "section_label": "px-3 pt-3 pb-1 text-[11px] uppercase tracking-wide text-[hsl(var(--sidebar-foreground)/0.55)]"
        }
      },
      "micro_interactions": [
        "Hover: background naik ke sidebar-muted (150ms)",
        "Active: sedikit glow shadow teal (tanpa gradient)",
        "Focus-visible: ring 2px pakai --focus"
      ],
      "data_testid": {
        "nav_item": "data-testid=\"sidebar-nav-item-<route>\"",
        "collapse_button": "data-testid=\"sidebar-collapse-button\""
      }
    },

    "stat_cards": {
      "treatment": "Card putih + strip warna kiri + header kecil + angka mono. Tambahkan tint background sangat halus (bukan gradient besar).",
      "classes": {
        "base": "relative overflow-hidden rounded-[10px] border border-border/70 bg-card p-3 md:p-4",
        "tint_primary": "bg-[hsl(var(--primary-soft))]",
        "tint_info": "bg-[hsl(var(--info-soft))]",
        "tint_success": "bg-[hsl(var(--success-soft))]",
        "tint_warning": "bg-[hsl(var(--warning-soft))]",
        "tint_danger": "bg-[hsl(var(--danger-soft))]"
      },
      "content_structure": [
        "Title (text-xs uppercase tracking-wide)",
        "Value (text-2xl font-display + font-mono untuk angka)",
        "Delta (badge kecil + ikon arrow)"
      ],
      "data_testid": {
        "stat_card": "data-testid=\"dashboard-stat-card-<key>\""
      }
    },

    "badges": {
      "bonus_type_badges": {
        "rule": "Warna bukan satu-satunya sinyal: selalu tampilkan label + ikon kecil (lucide) atau nomor bonus.",
        "mapping": {
          "bonus_1": "bg-[hsl(var(--bonus-1)/0.14)] text-[hsl(var(--bonus-1))] border border-[hsl(var(--bonus-1)/0.25)]",
          "bonus_2": "bg-[hsl(var(--bonus-2)/0.14)] text-[hsl(var(--bonus-2))] border border-[hsl(var(--bonus-2)/0.25)]",
          "bonus_3": "bg-[hsl(var(--bonus-3)/0.16)] text-[hsl(var(--bonus-3))] border border-[hsl(var(--bonus-3)/0.28)]",
          "bonus_4": "bg-[hsl(var(--bonus-4)/0.14)] text-[hsl(var(--bonus-4))] border border-[hsl(var(--bonus-4)/0.25)]",
          "bonus_5": "bg-[hsl(var(--bonus-5)/0.14)] text-[hsl(var(--bonus-5))] border border-[hsl(var(--bonus-5)/0.25)]",
          "bonus_6": "bg-[hsl(var(--bonus-6)/0.14)] text-[hsl(var(--bonus-6))] border border-[hsl(var(--bonus-6)/0.25)]",
          "bonus_7": "bg-[hsl(var(--bonus-7)/0.14)] text-[hsl(var(--bonus-7))] border border-[hsl(var(--bonus-7)/0.25)]"
        },
        "data_testid": "data-testid=\"bonus-type-badge-<bonusKey>\""
      },
      "announcement_category_badges": {
        "mapping": {
          "pengumuman": "bg-[hsl(var(--announce-pengumuman)/0.14)] text-[hsl(var(--announce-pengumuman))] border border-[hsl(var(--announce-pengumuman)/0.25)]",
          "promo": "bg-[hsl(var(--announce-promo)/0.14)] text-[hsl(var(--announce-promo))] border border-[hsl(var(--announce-promo)/0.25)]",
          "reward": "bg-[hsl(var(--announce-reward)/0.16)] text-[hsl(var(--announce-reward))] border border-[hsl(var(--announce-reward)/0.28)]",
          "penting": "bg-[hsl(var(--announce-penting)/0.14)] text-[hsl(var(--announce-penting))] border border-[hsl(var(--announce-penting)/0.25)]",
          "berita": "bg-[hsl(var(--announce-berita)/0.14)] text-[hsl(var(--announce-berita))] border border-[hsl(var(--announce-berita)/0.25)]"
        },
        "pinned": "Tambahkan ikon Pin + badge kecil 'Disematkan' (variant outline).",
        "data_testid": "data-testid=\"announcement-category-badge-<category>\""
      },
      "rank_badges": {
        "mapping": {
          "tier_1": "bg-[hsl(var(--rank-1)/0.14)] text-[hsl(var(--rank-1))] border border-[hsl(var(--rank-1)/0.25)]",
          "tier_2": "bg-[hsl(var(--rank-2)/0.16)] text-[hsl(var(--rank-2))] border border-[hsl(var(--rank-2)/0.28)]",
          "tier_3": "bg-[hsl(var(--rank-3)/0.14)] text-[hsl(var(--rank-3))] border border-[hsl(var(--rank-3)/0.25)]",
          "tier_4": "bg-[hsl(var(--rank-4)/0.14)] text-[hsl(var(--rank-4))] border border-[hsl(var(--rank-4)/0.25)]",
          "tier_5": "bg-[hsl(var(--rank-5)/0.14)] text-[hsl(var(--rank-5))] border border-[hsl(var(--rank-5)/0.25)]"
        }
      }
    },

    "tables": {
      "zebra_hover": {
        "wrapper": "rounded-[10px] border border-border/70 overflow-hidden",
        "thead": "bg-muted/40",
        "tr": "odd:bg-muted/30 hover:bg-accent/40",
        "selected": "data-[state=selected]:bg-primary/10",
        "sticky_header": "Jika tabel panjang: gunakan sticky top-0 pada header row (tanpa shadow berat)."
      },
      "filters_bar": {
        "pattern": "Bar filter compact di atas tabel: kiri (search + filter chips), kanan (bulk actions + export).",
        "classes": "flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
      },
      "data_testid": {
        "search": "data-testid=\"table-search-input\"",
        "bulk_action": "data-testid=\"table-bulk-action-<action>\"",
        "row": "data-testid=\"table-row-<id>\""
      }
    },

    "page_headers": {
      "treatment": "Header halaman dengan breadcrumb kecil + judul + actions. Tambahkan accent bar tipis di bawah judul (2px) pakai primary.",
      "structure": [
        "Breadcrumb (shadcn breadcrumb)",
        "Title + subtitle",
        "Actions (Button primary/secondary)"
      ],
      "classes": {
        "accent_bar": "mt-2 h-[2px] w-10 rounded-full bg-primary"
      }
    },

    "dialogs_and_forms": {
      "tambah_pengguna_role_adaptive": {
        "goal": "Field muncul sesuai peran. Validasi ketat: jika kolom penting kosong -> submit gagal + inline error + toast.",
        "layout": {
          "dialog_size": "max-w-[720px]",
          "grid": "grid grid-cols-1 md:grid-cols-2 gap-3",
          "section_divider": "Separator + label section (text-xs uppercase)"
        },
        "role_field_matrix": {
          "member": [
            "Nama", "No HP", "Email (opsional)", "Provinsi", "Kota/Kab", "Sponsor", "Placement", "Stokis", "PV (jika masih dipakai di sistem)", "Jenis Omset (jika masih dipakai di sistem)"
          ],
          "stokis": [
            "Nama", "No HP", "Email (opsional)", "Provinsi", "Kota/Kab"
          ],
          "admin_provinsi": [
            "Nama", "No HP", "Email (opsional)", "Provinsi"
          ],
          "admin_pusat": [
            "Nama", "No HP", "Email (opsional)"
          ]
        },
        "show_hide_rule": "Di UI: setelah role dipilih, render field group sesuai matrix. Jangan render placeholder field yang tidak relevan (bukan disabled), supaya tidak membingungkan.",
        "validation": {
          "inline": "Di bawah input: text-xs text-[hsl(var(--danger))] + ikon AlertCircle.",
          "field_state": "Input border jadi border-[hsl(var(--danger))] + ring-[hsl(var(--danger))]/20 saat error.",
          "submit": "Jika ada required kosong: blok submit, tampilkan toast sonner 'Lengkapi kolom wajib terlebih dahulu'.",
          "required_marker": "Label tambahkan * (text-danger)"
        },
        "data_testid": {
          "role_select": "data-testid=\"add-user-role-select\"",
          "submit": "data-testid=\"add-user-submit-button\"",
          "cancel": "data-testid=\"add-user-cancel-button\"",
          "field": "data-testid=\"add-user-field-<fieldKey>\"",
          "error": "data-testid=\"add-user-error-<fieldKey>\""
        }
      },

      "ubah_membership_peringkat": {
        "goal": "Admin Pusat bisa ubah membership & peringkat tanpa PV. Ada opsi reset ke otomatis.",
        "layout": "Dialog max-w-[640px], 2 kolom: kiri info member (readonly), kanan kontrol (Select membership, Select peringkat, Switch 'Otomatis').",
        "states": {
          "automatic_on": "Disable select manual + tampilkan helper text 'Mengikuti perhitungan sistem'.",
          "automatic_off": "Enable select manual + tampilkan warning soft 'Perubahan manual mempengaruhi tampilan & laporan'."
        },
        "data_testid": {
          "open": "data-testid=\"edit-membership-open-button\"",
          "membership": "data-testid=\"edit-membership-select\"",
          "rank": "data-testid=\"edit-rank-select\"",
          "auto": "data-testid=\"edit-rank-auto-switch\"",
          "submit": "data-testid=\"edit-membership-submit-button\""
        }
      }
    },

    "announcements": {
      "page": "/announcements",
      "feed_design": {
        "layout": "2 kolom di desktop: kiri feed (Card list), kanan panel 'Disematkan' + filter kategori/role. Mobile: 1 kolom.",
        "filters": "Tabs kategori (Pengumuman/Promo/Reward/Penting/Berita) + Select target role.",
        "card": {
          "base": "rounded-[10px] border border-border/70 bg-card overflow-hidden",
          "header": "px-4 py-3 bg-muted/35 flex items-start justify-between gap-3",
          "title": "font-display text-base font-semibold leading-snug",
          "meta": "text-xs text-muted-foreground",
          "content": "px-4 py-3 text-sm leading-relaxed",
          "footer": "px-4 py-3 flex items-center justify-between gap-3 border-t border-border/60",
          "image": "Jika ada image: AspectRatio 16/9, rounded-md, border, tampilkan di atas content (max height 180px)."
        },
        "pinned": "Pinned card punya strip kiri warna kategori + ikon Pin.",
        "empty_state": "Gunakan shadcn Card + ikon Megaphone (lucide) + CTA 'Buat Pengumuman'.",
        "dashboard_surface": "Di Dashboard tampilkan widget 'Pengumuman Terbaru' max 5 item, dengan badge kategori + tanggal."
      },
      "admin_actions": {
        "create_edit_delete": "Admin Pusat: tombol 'Buat' (primary), 'Edit' (ghost), 'Hapus' (destructive outline).",
        "published_toggle": "Switch 'Publikasikan' di form.",
        "target_roles": "Checkbox group untuk target roles (Admin Pusat/Provinsi/Stokis/Member)."
      },
      "data_testid": {
        "create": "data-testid=\"announcements-create-button\"",
        "card": "data-testid=\"announcement-card-<id>\"",
        "pin": "data-testid=\"announcement-pin-toggle-<id>\"",
        "publish": "data-testid=\"announcement-publish-toggle-<id>\"",
        "delete": "data-testid=\"announcement-delete-button-<id>\""
      }
    },

    "charts": {
      "recharts_palette": {
        "note": "Gunakan 7 warna bonus tokens untuk bar/stack/pie. Pastikan tooltip background putih + border.",
        "colors": [
          "hsl(var(--bonus-1))",
          "hsl(var(--bonus-2))",
          "hsl(var(--bonus-3))",
          "hsl(var(--bonus-4))",
          "hsl(var(--bonus-5))",
          "hsl(var(--bonus-6))",
          "hsl(var(--bonus-7))"
        ]
      },
      "chart_container": "Card dengan header compact + legend badges kecil (bukan legend default yang ramai).",
      "empty_state": "Jika data kosong: tampilkan Skeleton + teks 'Belum ada data pada periode ini'."
    }
  },

  "coherence_do_dont": {
    "do": [
      "Gunakan teal sebagai anchor (primary) + 1 aksen hangat (orange) + 1 aksen dingin (blue) untuk status.",
      "Warna dipakai untuk status/label, bukan dekorasi random.",
      "Pertahankan background hangat off-white agar tidak terasa klinis.",
      "Gunakan .font-mono untuk angka agar tabel rapi.",
      "Selalu sertakan label teks + ikon untuk status (warna bukan satu-satunya sinyal).",
      "Gunakan zebra + hover untuk scan tabel cepat.",
      "Semua elemen interaktif & info penting wajib punya data-testid (kebab-case)."
    ],
    "dont": [
      "Jangan jadikan semua card berwarna—cukup stat cards, badges, dan highlight.",
      "Jangan pakai gradient gelap/saturated (lihat aturan).",
      "Jangan pakai padding besar (hindari h-11 input).",
      "Jangan menaruh 7 warna chart sebagai warna tombol/CTA (CTA tetap primary/secondary).",
      "Jangan mengandalkan warna saja untuk error/sukses; selalu ada teks helper."
    ]
  },

  "image_urls": {
    "note": "Dashboard internal tidak butuh banyak foto. Gunakan ilustrasi ringan hanya untuk empty state (opsional).",
    "categories": [
      {
        "category": "empty_state_illustration_optional",
        "description": "Ilustrasi netral untuk halaman Pengumuman kosong / data kosong (opsional).",
        "image_urls": []
      }
    ]
  },

  "instructions_to_main_agent": [
    "Update /app/frontend/src/index.css :root dengan token di atas (existing + new).",
    "Turunkan --radius ke 0.625rem untuk tampilan lebih compact.",
    "Refactor komponen shared (AppShell, StatCard, Badges, BulkBar, PeriodFilter) untuk memakai class recipes compact.",
    "Implement sidebar gelap netral + active teal sesuai sidebar tokens (tanpa gradient).",
    "Implement tabel zebra/hover + header sticky untuk tabel panjang.",
    "Tambah halaman /announcements dengan feed + pinned panel + role targeting.",
    "Tambah dialog Tambah Pengguna role-adaptive: render field sesuai role_field_matrix; validasi required -> blok submit + inline errors + toast.",
    "Tambah dialog Ubah Membership & Peringkat: Admin Pusat bisa set manual tanpa PV; ada switch otomatis.",
    "Pastikan semua tombol, input, select, switch, row, card penting punya data-testid kebab-case dan tidak mengubah yang sudah ada.",
    "Jangan menambah library berat; cukup Tailwind + shadcn + recharts + sonner."
  ],

  "appendix_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
