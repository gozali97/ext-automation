import { AlertCircle, Check, Clock, Trash, ChevronDown, ChevronUp, Link } from "lucide-react"
import React, { useState } from "react"

import { cn } from "../lib/utils"
import type { TestCase } from "../types"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter, Typography, Input } from "./ui/index"

export interface TestCaseListProps {
  tests: TestCase[]
  onTestUpdate: (updatedTest: TestCase) => void
  onRunTests: (selectedTests: TestCase[]) => void
  clearResults: () => void
}

export const TestCaseList: React.FC<TestCaseListProps> = ({
  tests,
  onTestUpdate,
  onRunTests,
  clearResults
}) => {
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  const handleTestToggle = (test: TestCase) => {
    onTestUpdate({
      ...test,
      enabled: !test.enabled
    })
  }

  const getStatusIcon = (status: TestCase["status"]) => {
    switch (status) {
      case "success":
        return <Check className="w-5 h-5 text-green-500" />
      case "failed":
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case "running":
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />
      default:
        return null
    }
  }

  const toggleExpanded = (testId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTestId(expandedTestId === testId ? null : testId);
  }

  const handleTargetUrlChange = (test: TestCase, url: string) => {
    onTestUpdate({
      ...test,
      config: {
        ...test.config,
        targetUrl: url
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <Typography variant="h4">Available Tests</Typography>
      </div>

      <div className="grid gap-4">
        {tests.map((test, index) => (
          <Card
            key={`card-${index}`}
            className={cn(
              "relative transition-all",
              test.enabled && "ring-2 ring-blue-400 bg-blue-50",
              test.status === "success" && "bg-green-50",
              test.status === "failed" && "bg-red-50",
              test.status === "running" && "bg-blue-50"
            )}>
            <div className="absolute top-4 right-4">
              {getStatusIcon(test.status)}
            </div>
            <CardHeader 
              className="pb-3 cursor-pointer"
              onClick={() => handleTestToggle(test)}
            >
              <div className="flex gap-4 items-start">
                <input
                  type="checkbox"
                  checked={test.enabled}
                  onChange={(e) => {
                    // Stop propagation to prevent double toggle
                    e.stopPropagation();
                    handleTestToggle(test);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 w-4 h-4 text-blue-400 rounded border-gray-300 focus:ring-blue-400"
                />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <CardTitle>{test.name}</CardTitle>
                    <button 
                      onClick={(e) => toggleExpanded(test.id, e)}
                      className="p-1 ml-4 rounded-full hover:bg-gray-200"
                    >
                      {expandedTestId === test.id ? 
                        <ChevronUp className="w-4 h-4" /> : 
                        <ChevronDown className="w-4 h-4" />
                      }
                    </button>
                  </div>
                  <CardDescription>{test.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            {expandedTestId === test.id && (
              <CardContent className="pt-4 border-t">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target URL</label>
                    <div className="flex items-center space-x-2">
                      <Link className="w-4 h-4 text-gray-500" />
                      <Input 
                        type="url"
                        placeholder="https://example.com/specific-page"
                        value={test.config?.targetUrl || ''}
                        onChange={(e) => handleTargetUrlChange(test, e.target.value)}
                        className="flex-1 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      URL spesifik untuk test ini. Jika kosong, URL default dari konfigurasi akan digunakan.
                    </p>
                  </div>

                  {test.type === 'google' && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">
                        Login Google akan menggunakan alamat Gmail yang sudah dikonfigurasi di halaman Configuration.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
            
            {test.result && (
              <CardFooter className="pt-3 text-sm border-t">
                {test.result.success ? (
                  <span className="text-green-600">
                    Test completed successfully
                  </span>
                ) : (
                  <span className="text-red-600">
                    {test.result.error || "Test failed"}
                  </span>
                )}
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
