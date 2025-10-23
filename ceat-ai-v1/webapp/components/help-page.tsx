"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Search,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Video,
  Shirt,
  MessageCircle,
  Mail,
  FileText,
  ExternalLink,
} from "lucide-react"

interface FAQItem {
  id: string
  question: string
  answer: string
  category: string
}

export function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [openItems, setOpenItems] = useState<string[]>([])

  const faqItems: FAQItem[] = [
    {
      id: "1",
      question: "How do I generate high-quality images?",
      answer:
        "To generate high-quality images, use detailed prompts with specific descriptions. Include information about lighting, style, composition, and any specific elements you want. Higher resolutions like 1024x1024 or 1536x1536 will produce better quality results.",
      category: "Image Generation",
    },
    {
      id: "2",
      question: "What video formats are supported?",
      answer:
        "Our video generation supports MP4 format with various resolutions including 720p, 1080p, and 4K. Videos can be generated in different aspect ratios: 16:9 for landscape, 9:16 for portrait, and 1:1 for square formats.",
      category: "Video Generation",
    },
    {
      id: "3",
      question: "How does virtual try-on work?",
      answer:
        "Virtual try-on uses AI to realistically place products on people or models. Upload a person image and select a product from our library or upload your own. The AI will generate realistic visualizations showing how the product would look.",
      category: "Virtual Try-On",
    },
    {
      id: "4",
      question: "Can I download my generated content?",
      answer:
        "Yes, all generated content can be downloaded in high resolution. Click the download button on any generated image or video. You can also access all your content from the History page.",
      category: "General",
    },
    {
      id: "5",
      question: "What are the usage limits?",
      answer:
        "Usage limits depend on your plan. The Pro plan includes 1000 generations per month. You can check your current usage in the Settings page under Account Status.",
      category: "Account",
    },
    {
      id: "6",
      question: "How do I improve my prompts?",
      answer:
        'Use the "Rewrite" feature to enhance your prompts automatically. Be specific about style, lighting, composition, and details. Include relevant keywords like "professional", "cinematic", or "high-quality" for better results.',
      category: "Tips & Tricks",
    },
    {
      id: "7",
      question: "Can I use generated content commercially?",
      answer:
        "Yes, content generated with CEAT AI Studio can be used for commercial purposes within your organization. Please review our terms of service for specific usage rights and restrictions.",
      category: "Legal",
    },
    {
      id: "8",
      question: "How long does video generation take?",
      answer:
        "Video generation typically takes 2-5 minutes depending on the length and resolution. Longer videos (15 seconds) and higher resolutions (4K) will take more time to process.",
      category: "Video Generation",
    },
  ]

  const categories = [
    {
      name: "Image Generation",
      icon: ImageIcon,
      count: faqItems.filter((item) => item.category === "Image Generation").length,
    },
    {
      name: "Video Generation",
      icon: Video,
      count: faqItems.filter((item) => item.category === "Video Generation").length,
    },
    {
      name: "Virtual Try-On",
      icon: Shirt,
      count: faqItems.filter((item) => item.category === "Virtual Try-On").length,
    },
    { name: "General", icon: HelpCircle, count: faqItems.filter((item) => item.category === "General").length },
    { name: "Account", icon: FileText, count: faqItems.filter((item) => item.category === "Account").length },
    {
      name: "Tips & Tricks",
      icon: MessageCircle,
      count: faqItems.filter((item) => item.category === "Tips & Tricks").length,
    },
    { name: "Legal", icon: FileText, count: faqItems.filter((item) => item.category === "Legal").length },
  ]

  const filteredFAQs = faqItems.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const toggleItem = (id: string) => {
    setOpenItems((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Help Center</h1>
        <p className="text-muted-foreground">Find answers to common questions and learn how to use CEAT AI Studio</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.name}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <category.icon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{category.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {category.count}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Need More Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <Mail className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <MessageCircle className="w-4 h-4 mr-2" />
                Live Chat
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <ExternalLink className="w-4 h-4 mr-2" />
                Documentation
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>
                Frequently Asked Questions
                {searchQuery && (
                  <Badge variant="secondary" className="ml-2">
                    {filteredFAQs.length} results
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredFAQs.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No results found</p>
                  <p className="text-sm text-muted-foreground mt-2">Try adjusting your search terms</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredFAQs.map((item) => (
                    <Collapsible
                      key={item.id}
                      open={openItems.includes(item.id)}
                      onOpenChange={() => toggleItem(item.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="flex items-center gap-2">
                              {openItems.includes(item.id) ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium text-left">{item.question}</h3>
                              <Badge variant="outline" className="mt-2 text-xs">
                                {item.category}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-2">
                          <div className="pl-7">
                            <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Start Guide */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Quick Start Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border border-border rounded-lg">
                  <ImageIcon className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-medium mb-2">Generate Images</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter a prompt, adjust settings, and create stunning AI images
                  </p>
                </div>
                <div className="text-center p-4 border border-border rounded-lg">
                  <Video className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-medium mb-2">Create Videos</h3>
                  <p className="text-sm text-muted-foreground">
                    Generate dynamic videos from text or animate existing images
                  </p>
                </div>
                <div className="text-center p-4 border border-border rounded-lg">
                  <Shirt className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-medium mb-2">Virtual Try-On</h3>
                  <p className="text-sm text-muted-foreground">
                    Visualize products on models using AI-powered try-on technology
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
