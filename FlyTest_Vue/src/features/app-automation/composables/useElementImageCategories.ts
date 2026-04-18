import { ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { AppAutomationService } from '../services/appAutomationService'
import type { AppImageCategory } from '../types'

interface UseElementImageCategoriesOptions {
  getProjectId: () => number | null
  getSelectedCategory: () => string
  setSelectedCategory: (value: string) => void
}

export const useElementImageCategories = (options: UseElementImageCategoriesOptions) => {
  const imageCategories = ref<AppImageCategory[]>([])
  const newCategoryName = ref('')
  const categoryLoading = ref(false)
  const categorySaving = ref(false)
  const categoryDeleting = ref(false)

  const buildDefaultCategories = (): AppImageCategory[] => [{ name: 'common', count: 0, path: 'common' }]

  const syncSelectedCategory = (categories: AppImageCategory[]) => {
    if (!categories.some(item => item.name === options.getSelectedCategory())) {
      options.setSelectedCategory(categories[0]?.name || 'common')
    }
  }

  const loadCategories = async () => {
    const projectId = options.getProjectId()
    if (!projectId) {
      const categories = buildDefaultCategories()
      imageCategories.value = categories
      syncSelectedCategory(categories)
      return categories
    }

    categoryLoading.value = true
    try {
      const categories = await AppAutomationService.getElementImageCategories(projectId)
      const normalizedCategories = categories.length ? categories : buildDefaultCategories()
      imageCategories.value = normalizedCategories
      syncSelectedCategory(normalizedCategories)
      return normalizedCategories
    } catch (error: any) {
      Message.error(error.message || 'Failed to load image categories')
      return []
    } finally {
      categoryLoading.value = false
    }
  }

  const createCategory = async () => {
    const name = newCategoryName.value.trim()
    if (!name) {
      Message.warning('Please enter a category name')
      return null
    }

    const projectId = options.getProjectId()
    if (!projectId) {
      Message.warning('Please select a project first')
      return null
    }

    categorySaving.value = true
    try {
      const created = await AppAutomationService.createElementImageCategory(name, projectId)
      options.setSelectedCategory(created.name)
      newCategoryName.value = ''
      Message.success('Image category created')
      await loadCategories()
      return created
    } catch (error: any) {
      Message.error(error.message || 'Failed to create image category')
      return null
    } finally {
      categorySaving.value = false
    }
  }

  const deleteCategory = async (categoryName?: string) => {
    const targetCategory = String(categoryName || options.getSelectedCategory() || '').trim()
    if (!targetCategory || targetCategory === 'common') {
      Message.warning('The default category cannot be deleted')
      return false
    }

    const projectId = options.getProjectId()
    if (!projectId) {
      Message.warning('Please select a project first')
      return false
    }

    categoryDeleting.value = true
    try {
      await AppAutomationService.deleteElementImageCategory(targetCategory, projectId)
      options.setSelectedCategory('common')
      Message.success('Image category deleted')
      await loadCategories()
      return true
    } catch (error: any) {
      Message.error(error.message || 'Failed to delete image category')
      return false
    } finally {
      categoryDeleting.value = false
    }
  }

  return {
    imageCategories,
    newCategoryName,
    categoryLoading,
    categorySaving,
    categoryDeleting,
    loadCategories,
    createCategory,
    deleteCategory,
  }
}
