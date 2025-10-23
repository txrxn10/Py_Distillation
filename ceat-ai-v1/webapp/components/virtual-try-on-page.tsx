"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, User, Package, Shirt, Eye, Download, RefreshCw, UserPlus } from "lucide-react"

interface PersonModel {
  id: string
  name: string
  image: string
  type: "uploaded" | "library" | "virtual"
}

interface Product {
  id: string
  name: string
  image: string
  category: string
}

export function VirtualTryOnPage() {
  const [selectedPerson, setSelectedPerson] = useState<PersonModel | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [personTab, setPersonTab] = useState("upload")
  const [productTab, setProductTab] = useState("upload")

  // Mock data for library
  const personLibrary: PersonModel[] = [
    { id: "1", name: "Model 1", image: "/placeholder-x0rjk.png", type: "library" },
    { id: "2", name: "Model 2", image: "/placeholder-uoyrl.png", type: "library" },
    { id: "3", name: "Model 3", image: "/placeholder-uj617.png", type: "library" },
  ]

  const productLibrary: Product[] = [
    { id: "1", name: "CEAT Racing Tire", image: "/placeholder-ic8vm.png", category: "Racing" },
    { id: "2", name: "CEAT All-Season Tire", image: "/placeholder-bzhf6.png", category: "All-Season" },
    { id: "3", name: "CEAT Performance Tire", image: "/placeholder-8jpjx.png", category: "Performance" },
    { id: "4", name: "CEAT Eco Tire", image: "/placeholder-pw5o2.png", category: "Eco" },
  ]

  const handlePersonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setSelectedPerson({
          id: "uploaded",
          name: "Uploaded Image",
          image: result,
          type: "uploaded",
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setSelectedProduct({
          id: "uploaded",
          name: "Uploaded Product",
          image: result,
          category: "Custom",
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const createVirtualModel = () => {
    const virtualModel: PersonModel = {
      id: "virtual",
      name: "Virtual Model",
      image: "/placeholder-r5naj.png",
      type: "virtual",
    }
    setSelectedPerson(virtualModel)
  }

  const handleGenerate = async () => {
    if (!selectedPerson || !selectedProduct) return

    setIsGenerating(true)
    // Simulate API call
    setTimeout(() => {
      const mockImages = Array.from(
        { length: 4 },
        (_, i) =>
          `/placeholder.svg?height=300&width=300&query=virtual try-on result ${i + 1} ${selectedProduct.name} on ${selectedPerson.name}`,
      )
      setGeneratedImages(mockImages)
      setIsGenerating(false)
    }, 3000)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Virtual Try-On</h1>
        <p className="text-muted-foreground">
          Visualize products on different models using AI-powered virtual try-on technology
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Person Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Person Selection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={personTab} onValueChange={setPersonTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="upload" className="text-xs">
                    Upload
                  </TabsTrigger>
                  <TabsTrigger value="library" className="text-xs">
                    Library
                  </TabsTrigger>
                  <TabsTrigger value="virtual" className="text-xs">
                    Virtual
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-4 mt-4">
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    {selectedPerson?.type === "uploaded" ? (
                      <div className="space-y-2">
                        <img
                          src={selectedPerson.image || "/placeholder.svg"}
                          alt="Uploaded person"
                          className="w-24 h-32 object-cover rounded-lg mx-auto"
                        />
                        <p className="text-sm font-medium">{selectedPerson.name}</p>
                        <Button variant="outline" size="sm" onClick={() => setSelectedPerson(null)}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">Upload a person image</p>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handlePersonUpload}
                          className="hidden"
                          id="person-upload"
                        />
                        <Label htmlFor="person-upload" className="cursor-pointer">
                          <Button variant="outline" size="sm" asChild>
                            <span>Choose File</span>
                          </Button>
                        </Label>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="library" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    {personLibrary.map((person) => (
                      <div
                        key={person.id}
                        className={`cursor-pointer rounded-lg border-2 p-2 transition-colors ${
                          selectedPerson?.id === person.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedPerson(person)}
                      >
                        <img
                          src={person.image || "/placeholder.svg"}
                          alt={person.name}
                          className="w-full h-20 object-cover rounded"
                        />
                        <p className="text-xs text-center mt-1 font-medium">{person.name}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="virtual" className="space-y-4 mt-4">
                  <div className="text-center space-y-4">
                    {selectedPerson?.type === "virtual" ? (
                      <div className="space-y-2">
                        <img
                          src={selectedPerson.image || "/placeholder.svg"}
                          alt="Virtual model"
                          className="w-24 h-32 object-cover rounded-lg mx-auto"
                        />
                        <p className="text-sm font-medium">{selectedPerson.name}</p>
                        <Button variant="outline" size="sm" onClick={() => setSelectedPerson(null)}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <UserPlus className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-4">Create an AI-generated virtual model</p>
                        <Button onClick={createVirtualModel} variant="outline">
                          <UserPlus className="w-4 h-4 mr-2" />
                          Create Virtual Model
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Product Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Product Selection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={productTab} onValueChange={setProductTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">Upload</TabsTrigger>
                  <TabsTrigger value="library">Library</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-4 mt-4">
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    {selectedProduct?.id === "uploaded" ? (
                      <div className="space-y-2">
                        <img
                          src={selectedProduct.image || "/placeholder.svg"}
                          alt="Uploaded product"
                          className="w-20 h-20 object-cover rounded-lg mx-auto"
                        />
                        <p className="text-sm font-medium">{selectedProduct.name}</p>
                        <Button variant="outline" size="sm" onClick={() => setSelectedProduct(null)}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">Upload a product image</p>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleProductUpload}
                          className="hidden"
                          id="product-upload"
                        />
                        <Label htmlFor="product-upload" className="cursor-pointer">
                          <Button variant="outline" size="sm" asChild>
                            <span>Choose File</span>
                          </Button>
                        </Label>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="library" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    {productLibrary.map((product) => (
                      <div
                        key={product.id}
                        className={`cursor-pointer rounded-lg border-2 p-2 transition-colors ${
                          selectedProduct?.id === product.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedProduct(product)}
                      >
                        <img
                          src={product.image || "/placeholder.svg"}
                          alt={product.name}
                          className="w-full h-16 object-cover rounded"
                        />
                        <p className="text-xs text-center mt-1 font-medium">{product.name}</p>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {product.category}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Button
            onClick={handleGenerate}
            disabled={!selectedPerson || !selectedProduct || isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating Try-On...
              </>
            ) : (
              <>
                <Shirt className="w-4 h-4 mr-2" />
                Generate Try-On
              </>
            )}
          </Button>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Try-On Results</span>
                {generatedImages.length > 0 && <Badge variant="secondary">{generatedImages.length} results</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generatedImages.length === 0 ? (
                <div className="flex items-center justify-center h-96 border-2 border-dashed border-border rounded-lg">
                  <div className="text-center">
                    <Shirt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Virtual try-on results will appear here</p>
                    <p className="text-sm text-muted-foreground mt-2">Select a person and product to get started</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {generatedImages.map((image, index) => (
                      <div key={index} className="group relative coveredImage">
                        <img
                          src={image || "/placeholder.svg"}
                          alt={`Try-on result ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border border-border"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="secondary">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="secondary">
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Configuration:</span>
                      <Button size="sm" variant="outline">
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Regenerate All
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        <strong>Person:</strong> {selectedPerson?.name}
                      </p>
                      <p>
                        <strong>Product:</strong> {selectedProduct?.name}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
